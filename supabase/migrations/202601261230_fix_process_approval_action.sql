-- Fix approval sequencing and prevent out-of-order approvals
-- Key changes:
-- 1) process_approval_action now uses auth.uid() as the actor.
-- 2) It approves/rejects ONLY the CURRENT step (approval_requests.current_step).
-- 3) It resolves the correct approver (user/manager/role) and enforces it.
-- 4) It advances to the next step by creating the next pending approval_actions row.
-- 5) It only sets approval_requests.status='approved' when the last step is approved.

CREATE OR REPLACE FUNCTION public.process_approval_action(
  p_action text,
  p_attachments jsonb,
  p_comments text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_req approval_requests;
  v_now timestamptz := now();

  v_action text;
  v_step approval_steps;
  v_allowed boolean := false;
  v_expected_approver uuid;
  v_manager_id uuid;

  v_current_action_id uuid;
  v_next_step approval_steps;
  v_next_approver uuid;

  v_target_sr_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_req
  FROM approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Request is not pending' USING ERRCODE = 'P0001';
  END IF;

  -- normalize action
  IF lower(coalesce(p_action,'')) IN ('approve','approved','accept') THEN
    v_action := 'approved';
  ELSIF lower(coalesce(p_action,'')) IN ('reject','rejected','decline') THEN
    v_action := 'rejected';
  ELSIF lower(coalesce(p_action,'')) IN ('cancel','cancelled') THEN
    v_action := 'cancelled';
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action USING ERRCODE = 'P0001';
  END IF;

  -- current workflow step
  SELECT * INTO v_step
  FROM approval_steps
  WHERE workflow_id = v_req.workflow_id
    AND step_order = COALESCE(v_req.current_step, 1)
    AND is_active = true
  LIMIT 1;

  IF v_step.id IS NULL THEN
    RAISE EXCEPTION 'Current approval step not found for workflow % at step %', v_req.workflow_id, v_req.current_step
      USING ERRCODE = 'P0001';
  END IF;

  -- resolve expected approver and enforce
  v_expected_approver := NULL;
  IF v_step.approver_type IN ('user','specific_user') THEN
    v_expected_approver := v_step.approver_id;
    v_allowed := (v_expected_approver = v_actor);
  ELSIF v_step.approver_type IN ('manager','direct_manager') THEN
    SELECT manager_id INTO v_manager_id
    FROM profiles
    WHERE id = v_req.requester_id;

    v_expected_approver := v_manager_id;
    v_allowed := (v_expected_approver = v_actor);
  ELSIF v_step.approver_type = 'role' THEN
    v_allowed := EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = v_actor
        AND ur.role_id = (v_step.approver_criteria->>'role_id')::uuid
        AND ur.is_active = true
    );
    -- For role approvals we still stamp the actor as the approver.
    v_expected_approver := v_actor;
  ELSE
    RAISE EXCEPTION 'Unsupported approver_type: %', v_step.approver_type USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'You are not allowed to act on this step yet.' USING ERRCODE = 'P0001';
  END IF;

  -- ensure a pending action exists for the current step and this approver
  SELECT id INTO v_current_action_id
  FROM approval_actions
  WHERE request_id = v_req.id
    AND step_id = v_step.id
    AND action = 'pending'
    AND approver_id = v_expected_approver
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_current_action_id IS NULL THEN
    -- Create it if it doesn't exist (first time).
    INSERT INTO approval_actions (
      id, request_id, step_id, approver_id,
      action, comments, attachments, action_date, created_at
    )
    VALUES (
      gen_random_uuid(), v_req.id, v_step.id, v_expected_approver,
      'pending', NULL, '[]'::jsonb, NULL, v_now
    )
    RETURNING id INTO v_current_action_id;
  END IF;

  -- update the current step action
  UPDATE approval_actions
  SET action = v_action,
      comments = p_comments,
      attachments = COALESCE(p_attachments, '[]'::jsonb),
      action_date = v_now
  WHERE id = v_current_action_id;

  -- If rejected/cancelled => close request immediately
  IF v_action IN ('rejected','cancelled') THEN
    UPDATE approval_requests
    SET status = v_action,
        completed_at = v_now,
        updated_at = v_now
    WHERE id = v_req.id;
  ELSE
    -- approved => move to next step or close if last
    SELECT * INTO v_next_step
    FROM approval_steps
    WHERE workflow_id = v_req.workflow_id
      AND step_order = COALESCE(v_req.current_step, 1) + 1
      AND is_active = true
    ORDER BY step_order
    LIMIT 1;

    IF v_next_step.id IS NULL THEN
      UPDATE approval_requests
      SET status = 'approved',
          completed_at = v_now,
          updated_at = v_now
      WHERE id = v_req.id;
    ELSE
      -- advance request
      UPDATE approval_requests
      SET current_step = v_next_step.step_order,
          status = 'pending',
          updated_at = v_now
      WHERE id = v_req.id;

      -- resolve next approver
      v_next_approver := NULL;
      IF v_next_step.approver_type IN ('user','specific_user') THEN
        v_next_approver := v_next_step.approver_id;
      ELSIF v_next_step.approver_type IN ('manager','direct_manager') THEN
        SELECT manager_id INTO v_next_approver
        FROM profiles
        WHERE id = v_req.requester_id;
      ELSIF v_next_step.approver_type = 'role' THEN
        SELECT ur.user_id INTO v_next_approver
        FROM user_roles ur
        WHERE ur.role_id = (v_next_step.approver_criteria->>'role_id')::uuid
          AND ur.is_active = true
        ORDER BY ur.created_at ASC
        LIMIT 1;
      ELSE
        RAISE EXCEPTION 'Unsupported approver_type %', v_next_step.approver_type USING ERRCODE = 'P0001';
      END IF;

      IF v_next_approver IS NULL THEN
        RAISE EXCEPTION 'Unable to resolve next approver for step %', v_next_step.step_order USING ERRCODE = 'P0001';
      END IF;

      -- create next pending action (one per step)
      INSERT INTO approval_actions (
        id, request_id, step_id, approver_id,
        action, comments, attachments, action_date, created_at
      )
      VALUES (
        gen_random_uuid(), v_req.id, v_next_step.id, v_next_approver,
        'pending', NULL, '[]'::jsonb, NULL, v_now
      );
    END IF;
  END IF;

  -- parse request_data -> summary_request_id (used by procurement SR approvals)
  BEGIN
    v_target_sr_id := (v_req.request_data->>'summary_request_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_target_sr_id := NULL;
  END;

  IF v_target_sr_id IS NOT NULL THEN
    UPDATE proc_docs
    SET status = CASE
        WHEN (SELECT status FROM approval_requests WHERE id = v_req.id) = 'approved' THEN 'approved'::proc_doc_status
        WHEN (SELECT status FROM approval_requests WHERE id = v_req.id) = 'rejected' THEN 'rejected'::proc_doc_status
        WHEN (SELECT status FROM approval_requests WHERE id = v_req.id) = 'cancelled' THEN 'cancelled'::proc_doc_status
        ELSE status
      END,
      payload = jsonb_strip_nulls(
        coalesce(payload,'{}'::jsonb)
        || jsonb_build_object(
          'last_approval_comment', p_comments,
          'last_approval_attachments', COALESCE(p_attachments, '[]'::jsonb),
          'approval_request_id', v_req.id
        )
      ),
      updated_at = v_now
    WHERE id = v_target_sr_id
      AND doc_type = 'SR';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'approval_request_id', v_req.id,
    'approval_status', (SELECT status FROM approval_requests WHERE id = v_req.id),
    'current_step', (SELECT current_step FROM approval_requests WHERE id = v_req.id),
    'acted_by', v_actor,
    'step_id', v_step.id,
    'summary_request_id', v_target_sr_id
  );
END;
$function$;
