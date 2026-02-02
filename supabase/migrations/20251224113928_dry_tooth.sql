/*
  # Fix timestamp type mismatch in get_monthly_timesheets_with_details_safe function

  1. Function Updates
    - Update the RETURNS TABLE declaration to use timestamptz for the 7th column
    - This resolves the type mismatch error where the function returns timestamptz but declares timestamp

  2. Changes Made
    - Modified the function signature to match actual return types
    - Ensures compatibility between declared and actual return types
*/

CREATE OR REPLACE FUNCTION get_monthly_timesheets_with_details_safe(
  p_user_id uuid DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  year integer,
  month integer,
  total_hours numeric,
  status text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  employee_name text,
  employee_email text,
  approval_step_id uuid,
  approval_step_name text,
  step_order integer,
  approver_id uuid,
  approver_name text,
  approver_email text,
  approval_status text,
  approval_date timestamptz,
  approval_comments text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.employee_id,
    mt.year,
    mt.month,
    mt.total_hours,
    mt.status,
    mt.submitted_at,
    mt.created_at,
    mt.updated_at,
    emp.full_name as employee_name,
    emp.email as employee_email,
    ast.id as approval_step_id,
    ast.name as approval_step_name,
    ast.step_order,
    approver.id as approver_id,
    approver.full_name as approver_name,
    approver.email as approver_email,
    ar.status as approval_status,
    ar.approved_at as approval_date,
    ar.comments as approval_comments
  FROM monthly_timesheets mt
  LEFT JOIN profiles emp ON mt.employee_id = emp.id
  LEFT JOIN approval_steps ast ON ast.workflow_id = (
    SELECT workflow_id FROM approval_workflows 
    WHERE entity_type = 'timesheet' 
    AND department_id = emp.department_id 
    LIMIT 1
  )
  LEFT JOIN profiles approver ON ast.approver_id = approver.id
  LEFT JOIN approval_requests ar ON ar.entity_id = mt.id 
    AND ar.entity_type = 'timesheet' 
    AND ar.step_id = ast.id
  WHERE (p_user_id IS NULL OR mt.employee_id = p_user_id)
    AND (p_year IS NULL OR mt.year = p_year)
    AND (p_month IS NULL OR mt.month = p_month)
  ORDER BY mt.created_at DESC, ast.step_order ASC;
END;
$$;