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
