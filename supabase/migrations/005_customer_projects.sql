create table if not exists public.customer_projects (
 id uuid primary key,
 customer_name text not null check(length(customer_name) between 1 and 180),
 phone text not null default '' check(length(phone)<=40),
 email text not null default '' check(length(email)<=180),
 action text not null check(action in('save','export','quote')),
 project jsonb not null check(jsonb_typeof(project)='object' and octet_length(project::text)<=120000),
 status text not null default 'new' check(status in('new','contacted','quoted','done','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.customer_projects enable row level security;
revoke all on public.customer_projects from anon,authenticated;
grant select on public.customer_projects to authenticated;
grant update(status) on public.customer_projects to authenticated;
drop policy if exists "admins read customer projects" on public.customer_projects;
create policy "admins read customer projects" on public.customer_projects for select to authenticated using(public.is_admin());
drop policy if exists "admins update customer projects" on public.customer_projects;
create policy "admins update customer projects" on public.customer_projects for update to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.customer_capture_enabled() returns boolean language sql stable security definer set search_path='' as $$ select true; $$;
create or replace function public.register_customer_project(p_id uuid,p_name text,p_phone text,p_email text,p_action text,p_project jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 180 or p_phone is null or length(p_phone)>40 or p_email is null or length(p_email)>180 or p_action is null or p_action not in('save','export','quote') or p_project is null or jsonb_typeof(p_project)<>'object' or octet_length(p_project::text)>120000 or coalesce(length(p_project->>'model'),0) not between 1 and 80 then raise exception 'Invalid customer project';end if;
 insert into public.customer_projects(id,customer_name,phone,email,action,project) values(p_id,trim(p_name),trim(p_phone),trim(p_email),p_action,p_project) on conflict(id) do nothing;
end;$$;
revoke all on function public.customer_capture_enabled(),public.register_customer_project(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.customer_capture_enabled(),public.register_customer_project(uuid,text,text,text,text,jsonb) to anon,authenticated;
