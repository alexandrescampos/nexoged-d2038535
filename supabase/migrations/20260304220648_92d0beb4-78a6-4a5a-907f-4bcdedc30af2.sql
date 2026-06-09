
-- Drop tables (dependency order)
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Drop functions that depended on these tables
DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_manager_see_client(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_project_ids(uuid);
DROP FUNCTION IF EXISTS public.get_project_members_profiles(uuid[]);
DROP FUNCTION IF EXISTS public.validate_time_entry_date();

-- Drop orphan enum types
DROP TYPE IF EXISTS public.project_status;
DROP TYPE IF EXISTS public.time_entry_status;
