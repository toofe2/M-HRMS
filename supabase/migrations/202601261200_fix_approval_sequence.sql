-- Fix: enforce sequential approvals and correct approver identity
-- Date: 2026-01-26

BEGIN;

DROP TRIGGER IF EXISTS trg_handle_approval_progression ON public.approval_actions;
DROP TRIGGER IF EXISTS trg_advance_approval_step_on_action ON public.approval_actions;

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
  v_req public.approval_requests%ROWTYPE;
  v_step public.approval_steps%ROWTYPE;
  v_next_step public.approval_steps%ROWTYPE;
  v_actor uuid;
  v_expected uuid;
  v_now timestamptz := now();
  v_new_status text;
  v_target_sr_id uuid;
  v_total_steps int;
  v_step_id uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_req.status IN ('approved','rejected','cancelled') THEN
    RAISE EXCEPTION 'Request already completed';
  END IF;

  IF lower(p_action) IN ('approve','approved','accept') THEN
    v_new_status := 'approved';
  ELSIF lower(p_action) IN ('reject','rejected','decline') THEN
    v_new_status := 'rejected';
  ELSIF lower(p_action) IN ('cancel','cancelled') THEN
    v_new_status := 'cancelled';
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  SELECT * INTO v_step
  FROM public.approval_steps
  WHERE workflow_id = v_req.workflow_id
    AND step_order = COALESCE(v_req.current_step, 1)
    AND is_active = true
  ORDER BY step_order
  LIMIT 1;

  IF v_step.id IS NULL THEN
    RAISE EXCEPTION 'Current step not found for workflow % (step %)', v_req.workflow_id, v_req.current_step;
  END IF;

  v_step_id := v_step.id;

  -- Resolve who is allowed to act on THIS step
  CASE v_step.approver_type
    WHEN 'user', 'specific_user' THEN
      v_expected := v_step.approver_id;
    WHEN 'manager', 'direct_manager' THEN
      SELECT manager_id INTO v_expected FROM public.profiles WHERE id = v_req.requester_id;
    WHEN 'role' THEN
      SELECT ur.user_id INTO v_expected
      FROM public.user_roles ur
      WHERE ur.role_id = (v_step.approver_criteria->>'role_id')::uuid
        AND ur.is_active = true
      ORDER BY ur.created_at DESC
      LIMIT 1;
    ELSE
      RAISE EXCEPTION 'Unsupported approver_type %', v_step.approver_type;
  END CASE;

  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve approver for step %', v_step_id;
  END IF;

  IF v_actor <> v_expected THEN
    RAISE EXCEPTION 'Not allowed: you are not the current approver';
  END IF;

  -- Ensure there is a "pending" row for current step (1 per step)
  INSERT INTO public.approval_actions (
    request_id, step_id, approver_id, action, comments, attachments, action_date
  )
  SELECT p_request_id, v_step_id, v_expected, 'pending', NULL, '[]'::jsonb, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_actions a
    WHERE a.request_id = p_request_id AND a.step_id = v_step_id AND a.action = 'pending'
  );

  -- Close the current pending action
  UPDATE public.approval_actions
     SET action = v_new_status,
         comments = p_comments,
         attachments = COALESCE(p_attachments, '[]'::jsonb),
         action_date = v_now
   WHERE request_id = p_request_id
     AND step_id = v_step_id
     AND action = 'pending'
     AND approver_id = v_expected;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending action found for current step (already decided?)';
  END IF;

  -- Count total active steps
  SELECT count(*) INTO v_total_steps
  FROM public.approval_steps
  WHERE workflow_id = v_req.workflow_id AND is_active = true;

  -- Decide progression
  IF v_new_status = 'approved' THEN
    -- next step
    SELECT * INTO v_next_step
    FROM public.approval_steps
    WHERE workflow_id = v_req.workflow_id
      AND step_order = COALESCE(v_req.current_step,1) + 1
      AND is_active = true
    ORDER BY step_order
    LIMIT 1;

    IF v_next_step.id IS NULL THEN
      -- finished
      UPDATE public.approval_requests
         SET status = 'approved',
             completed_at = v_now,
             updated_at = v_now
       WHERE id = p_request_id;
    ELSE
      -- move to next step
      UPDATE public.approval_requests
         SET current_step = COALESCE(v_req.current_step,1) + 1,
             status = 'pending',
             updated_at = v_now
       WHERE id = p_request_id;

      -- create pending action for next step (but do NOT let anyone else approve this step)
      -- resolve next approver
      v_expected := NULL;
      CASE v_next_step.approver_type
        WHEN 'user', 'specific_user' THEN
          v_expected := v_next_step.approver_id;
        WHEN 'manager', 'direct_manager' THEN
          SELECT manager_id INTO v_expected FROM public.profiles WHERE id = v_req.requester_id;
        WHEN 'role' THEN
          SELECT ur.user_id INTO v_expected
          FROM public.user_roles ur
          WHERE ur.role_id = (v_next_step.approver_criteria->>'role_id')::uuid
            AND ur.is_active = true
          ORDER BY ur.created_at DESC
          LIMIT 1;
        ELSE
          RAISE EXCEPTION 'Unsupported approver_type %', v_next_step.approver_type;
      END CASE;

      IF v_expected IS NULL THEN
        RAISE EXCEPTION 'Unable to resolve approver for next step %', v_next_step.id;
      END IF;

      INSERT INTO public.approval_actions (
        request_id, step_id, approver_id, action, created_at
      )
      VALUES (
        p_request_id, v_next_step.id, v_expected, 'pending', v_now
      );
    END IF;

  ELSE
    -- rejected/cancelled -> finish
    UPDATE public.approval_requests
       SET status = v_new_status,
           completed_at = v_now,
           updated_at = v_now
     WHERE id = p_request_id;
  END IF;

  -- Try to parse summary_request_id from request_data (procurement SR)
  BEGIN
    v_target_sr_id := (v_req.request_data->>'summary_request_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_target_sr_id := NULL;
  END;

  IF v_target_sr_id IS NOT NULL THEN
    UPDATE public.proc_docs
       SET status = CASE v_new_status
                      WHEN 'approved'  THEN 'approved'::public.proc_doc_status
                      WHEN 'rejected'  THEN 'rejected'::public.proc_doc_status
                      WHEN 'cancelled' THEN 'cancelled'::public.proc_doc_status
                      ELSE status
                    END,
           payload = jsonb_strip_nulls(
             COALESCE(payload,'{}'::jsonb) || jsonb_build_object(
               'last_approval_comment', p_comments,
               'last_approval_attachments', COALESCE(p_attachments,'[]'::jsonb),
               'approval_request_id', p_request_id
             )
           ),
           updated_at = v_now
     WHERE id = v_target_sr_id
       AND doc_type = 'SR';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'approval_request_id', p_request_id,
    'approval_status', v_new_status,
    'current_step', (SELECT current_step FROM public.approval_requests WHERE id = p_request_id),
    'summary_request_id', v_target_sr_id
  );
END;
$function$;

COMMIT;
