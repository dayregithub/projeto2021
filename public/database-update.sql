-- Atualização de banco existente: preserva produtos, pedidos e usuários.
begin;
-- Execute uma vez após 001_platform.sql. Não altera dados anteriores.
create table if not exists public.issued_quotes (
 id uuid primary key default gen_random_uuid(), quote_number text not null unique check(length(quote_number) between 1 and 60),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=1500000),updated_at timestamptz not null default now()
);
alter table public.issued_quotes enable row level security;
revoke all on public.issued_quotes from anon,authenticated;
grant select,insert,update,delete on public.issued_quotes to authenticated;
drop policy if exists "administrators manage issued quotes" on public.issued_quotes;
create policy "administrators manage issued quotes" on public.issued_quotes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table if not exists public.pricing_profiles(id text primary key check(id='default'),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=500000),updated_at timestamptz not null default now());
alter table public.pricing_profiles enable row level security;
revoke all on public.pricing_profiles from anon,authenticated;
grant select,insert,update,delete on public.pricing_profiles to authenticated;
drop policy if exists "administrators manage pricing profiles" on public.pricing_profiles;
create policy "administrators manage pricing profiles" on public.pricing_profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Instale após as tabelas de painel/orçamentos. Cópias privadas por dispositivo.
create table if not exists public.workspace_backups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 device_id uuid not null,
 device_name text not null check(length(device_name) between 1 and 100),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=8000000),
 updated_at timestamptz not null default now(),
 unique(owner_id,device_id)
);
alter table public.workspace_backups enable row level security;
revoke all on public.workspace_backups from anon,authenticated;
grant select,insert,update,delete on public.workspace_backups to authenticated;
drop policy if exists "admin owns workspace backup" on public.workspace_backups;
create policy "admin owns workspace backup" on public.workspace_backups for all to authenticated using(owner_id=auth.uid() and public.is_admin()) with check(owner_id=auth.uid() and public.is_admin());

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

-- Atualiza somente a validação de novos cadastros. Preserva todos os registros anteriores.
create or replace function public.register_customer_project(p_id uuid,p_name text,p_phone text,p_email text,p_action text,p_project jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 180 or p_phone is null or length(p_phone)>40 or p_email is null or length(p_email)>180 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_action is null or p_action not in('save','export','quote') or p_project is null or jsonb_typeof(p_project)<>'object' or octet_length(p_project::text)>120000 or coalesce(length(p_project->>'model'),0) not between 1 and 80 then raise exception 'Invalid customer project';end if;
 insert into public.customer_projects(id,customer_name,phone,email,action,project) values(p_id,trim(p_name),trim(p_phone),trim(p_email),p_action,p_project) on conflict(id) do nothing;
end;$$;

-- Despesas privadas; recebimentos continuam vinculados aos orçamentos.
create table if not exists public.finance_expenses (
 id uuid primary key default gen_random_uuid(),
 description text not null check(length(trim(description)) between 1 and 180),
 category text not null check(length(trim(category)) between 1 and 80),
 amount numeric(14,2) not null check(amount > 0 and amount <= 1000000000),
 due_on date not null,
 status text not null default 'pending' check(status in ('pending','paid')),
 paid_on date,
 updated_at timestamptz not null default now(),
 check((status='paid' and paid_on is not null) or (status='pending' and paid_on is null))
);
alter table public.finance_expenses enable row level security;
revoke all on public.finance_expenses from anon, authenticated;
grant select,insert,update,delete on public.finance_expenses to authenticated;
drop policy if exists "administrators manage finance expenses" on public.finance_expenses;
create policy "administrators manage finance expenses" on public.finance_expenses for all to authenticated using(public.is_admin()) with check(public.is_admin());

commit;
