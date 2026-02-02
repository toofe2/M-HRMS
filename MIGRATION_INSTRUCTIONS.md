# URGENT: Fix for Missing approval_workflows Table Error

The application is failing because your Supabase database schema is out of sync. The database still has dependencies on the `approval_workflows` table that was removed in recent migrations, but these migrations haven't been applied yet.

## IMMEDIATE STEPS TO FIX:

### Method 1: Apply All Migrations via Supabase Dashboard

1. **Go to your Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Apply ALL Pending Migrations**
   - You need to run ALL migration files in the `supabase/migrations/` folder
   - Run them in chronological order (by filename date)
   - Start with the oldest and work your way to the newest
   - Copy the entire contents of each migration file and run them one by one

### Method 2: Use Supabase CLI (Recommended)

If you have the Supabase CLI installed locally:

```bash
supabase db push
```

This will automatically apply all pending migrations to your database in the correct order.

### Method 3: Reset Database (If other methods fail)

**WARNING: This will delete all your data!**

If the above methods don't work due to conflicting schema changes:

1. Go to Supabase Dashboard → Settings → Database
2. Click "Reset Database" 
3. Confirm the reset
4. Run `supabase db push` to apply all migrations from scratch

## What These Migrations Do:

- Remove the `approval_workflows` table and its dependencies
- Simplify the leave approval system to use direct manager approval
- Update the `leave_requests` table structure
- Create proper RLS policies for the new simplified system
- Set up triggers for automatic leave balance management

## Verification:

After running the migrations:

1. Go to "Table Editor" in your Supabase dashboard
2. Verify that the `approval_workflows` table is NOT present
3. Verify that the `leave_requests` table exists with the correct structure
4. Verify that the `leave_balances` table exists
5. Refresh your application - the error should be resolved

## If You Still Get Errors:

If you continue to see the "approval_workflows does not exist" error after applying migrations, it means some database objects (triggers, functions, or constraints) are still referencing the old table. In this case, you may need to reset your database completely using Method 3 above.

The error occurs because the application code has been updated to work with the new simplified schema, but your database is still using the old schema with `approval_workflows` dependencies.