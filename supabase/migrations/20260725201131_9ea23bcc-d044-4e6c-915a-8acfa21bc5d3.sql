ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_author_id_fkey;
ALTER TABLE public.attorney_permissions DROP CONSTRAINT IF EXISTS attorney_permissions_user_id_fkey;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_attorney_id_fkey;
ALTER TABLE public.lead_history DROP CONSTRAINT IF EXISTS lead_history_performed_by_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;