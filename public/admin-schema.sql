-- Execute no SQL Editor do SEU projeto Supabase. Nunca coloque service_role no site.
create table public.admin_users (id uuid primary key references auth.users(id) on delete cascade);
alter table public.admin_users enable row level security;
create policy "admin sees own permission" on public.admin_users for select to authenticated using (id=auth.uid());
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.admin_users where id=auth.uid()); $$;
create function public.require_admin() returns boolean language plpgsql stable security definer set search_path='' as $$ begin if not public.is_admin() then raise exception 'Unauthorized'; end if; return true; end; $$;
create table public.catalog_products (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 80), description text not null check(length(description)<=1000), image_url text check(image_url is null or image_url ~ '^https://'), settings jsonb not null check(jsonb_typeof(settings)='object' and octet_length(settings::text)<=20000), published boolean not null default false, created_at timestamptz not null default now()
);
alter table public.catalog_products enable row level security;
create policy "published products or admin" on public.catalog_products for select to anon,authenticated using (published or public.is_admin());
create policy "admin manages products" on public.catalog_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create table public.site_events (id bigint generated always as identity primary key, kind text not null check(kind in ('page_view','model_view','download')), model_id text not null default '', product_id uuid, format text not null default '', created_at timestamptz not null default now());
create index on public.site_events(created_at,kind);
alter table public.site_events enable row level security;
create policy "admin reads metrics" on public.site_events for select to authenticated using (public.is_admin());
create function public.record_site_event(p_kind text,p_model text default '',p_format text default '',p_product uuid default null) returns void language plpgsql security definer set search_path='' as $$ begin
 if p_kind not in ('page_view','model_view','download') or p_model !~ '^[a-zA-Z0-9_-]{0,60}$' or p_format not in ('','svg','dxf','pdf','stl','json','zip','eml') then raise exception 'Invalid event'; end if;
 insert into public.site_events(kind,model_id,format,product_id) values(p_kind,p_model,p_format,p_product);
end; $$;
create table public.quote_requests (id uuid primary key, customer_name text not null check(length(customer_name) between 1 and 100),contact text not null check(length(contact) between 3 and 180),message text not null check(length(message)<=2000),project jsonb not null check(jsonb_typeof(project)='object' and octet_length(project::text)<=20000),status text not null default 'new' check(status in ('new','contacted','quoted','closed')),created_at timestamptz not null default now());
alter table public.quote_requests enable row level security;
create policy "admin reads quotes" on public.quote_requests for select to authenticated using(public.is_admin());
create policy "admin updates quotes" on public.quote_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create function public.submit_quote(p_id uuid,p_name text,p_contact text,p_message text,p_project jsonb) returns void language plpgsql security definer set search_path='' as $$ begin
 if length(trim(p_name))<1 or length(trim(p_contact))<3 then raise exception 'Name and contact required'; end if;
 insert into public.quote_requests(id,customer_name,contact,message,project) values(p_id,trim(p_name),trim(p_contact),p_message,p_project) on conflict(id) do nothing;
end; $$;
create function public.admin_dashboard(p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cutoff timestamptz; result jsonb; begin
 perform public.require_admin();
 if p_days not in(7,30,90) then raise exception 'Invalid period'; end if;
 cutoff=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' - make_interval(days=>p_days-1);
 select jsonb_build_object(
 'visits',(select count(*) from public.site_events where kind='page_view' and created_at>=cutoff),
 'views',(select count(*) from public.site_events where kind='model_view' and created_at>=cutoff),
 'downloads',(select count(*) from public.site_events where kind='download' and created_at>=cutoff),
 'quotes',(select count(*) from public.quote_requests where created_at>=cutoff),
 'series',(select jsonb_agg(jsonb_build_object('day',to_char(d,'YYYY-MM-DD'),'visits',(select count(*) from public.site_events e where e.kind='page_view' and (e.created_at at time zone 'UTC')::date=d::date),'downloads',(select count(*) from public.site_events e where e.kind='download' and (e.created_at at time zone 'UTC')::date=d::date)) order by d) from generate_series(cutoff at time zone 'UTC',date_trunc('day',now() at time zone 'UTC'),interval '1 day') d),
 'top',coalesce((select jsonb_agg(t) from(select model_id as model,product_id as product,format,count(*) as total from public.site_events where kind='download' and created_at>=cutoff group by model_id,product_id,format order by total desc limit 20)t),'[]'::jsonb)
 ) into result;return result;end; $$;
-- Explicit privileges: anonymous callers can only write via bounded functions.
revoke all on public.admin_users,public.site_events,public.quote_requests,public.catalog_products from anon,authenticated;
grant select on public.admin_users,public.site_events,public.quote_requests to authenticated;
grant update(status) on public.quote_requests to authenticated;
grant select on public.catalog_products to anon,authenticated;
grant insert,update,delete on public.catalog_products to authenticated;
revoke all on function public.is_admin(),public.require_admin(),public.admin_dashboard(integer),public.record_site_event(text,text,text,uuid),public.submit_quote(uuid,text,text,text,jsonb) from public;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.require_admin(),public.admin_dashboard(integer) to authenticated;
grant execute on function public.record_site_event(text,text,text,uuid),public.submit_quote(uuid,text,text,text,jsonb) to anon,authenticated;
