-- ARAM store · 99 · read-only installation check. Changes nothing. Safe to run any time.
-- Expected after a full install: migrations 0001…0006 (+seed); "tables without RLS" = none; missing functions = none;
-- storage bucket = product-images; payment providers listed; super admins = 1 once 08 has been run.
select 'migrations applied' as check_name, coalesce(string_agg(version, ', ' order by version), 'none') as result from public.aram_migrations
union all select 'public tables without RLS', coalesce((select string_agg(tablename, ', ' order by tablename) from pg_tables where schemaname = 'public' and not rowsecurity), 'none (good)')
union all select 'RLS policies in public', (select count(*)::text from pg_policies where schemaname = 'public')
union all select 'missing functions', coalesce((select string_agg(f, ', ') from unnest(array['has_perm','is_admin','my_permissions','place_order','cancel_my_order','mark_order_paid','validate_coupon','admin_stats','search_products','catalog_facets','enqueue_order_email','norm_fa']) as f where to_regproc('public.' || f) is null), 'none (good)')
union all select 'triggers in public', (select count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal)
union all select 'signup trigger on auth.users', coalesce((select tgname::text from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'), 'MISSING')
union all select 'storage bucket', coalesce((select id from storage.buckets where id = 'product-images'), 'MISSING')
union all select 'payment providers', coalesce((select string_agg(key || case when is_enabled then ' (on)' else ' (off)' end, ', ' order by sort_order) from public.payment_providers), 'none')
union all select 'admin roles', coalesce((select string_agg(name, ', ' order by name) from public.admin_roles), 'none (run seed)')
union all select 'super admins', (select count(*)::text from public.admin_users au join public.admin_roles r on r.id = au.role_id where r.name = 'super_admin')
union all select 'sample products', (select count(*)::text from public.products);
