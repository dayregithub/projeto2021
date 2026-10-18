-- Execute uma vez após 001_platform.sql. Não altera dados anteriores.
create table public.issued_quotes (
 id uuid primary key default gen_random_uuid(), quote_number text not null unique check(length(quote_number) between 1 and 60),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=1500000),updated_at timestamptz not null default now()
);
alter table public.issued_quotes enable row level security;
revoke all on public.issued_quotes from anon,authenticated;
grant select,insert,update,delete on public.issued_quotes to authenticated;
create policy "administrators manage issued quotes" on public.issued_quotes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.pricing_profiles(id text primary key check(id='default'),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=500000),updated_at timestamptz not null default now());
alter table public.pricing_profiles enable row level security;
revoke all on public.pricing_profiles from anon,authenticated;
grant select,insert,update,delete on public.pricing_profiles to authenticated;
create policy "administrators manage pricing profiles" on public.pricing_profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
