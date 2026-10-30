-- Fechamentos gerenciais privados e imutáveis. Não altera orçamentos/despesas.
create table if not exists public.finance_reports (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 160),
 period_from date,
 period_to date,
 created_at timestamptz not null default now(),
 data jsonb not null check(jsonb_typeof(data)='object' and coalesce(data->>'version','')='1' and coalesce(jsonb_typeof(data->'report'),'')='object' and pg_column_size(data)<=10000000),
 check(period_from is null or period_to is null or period_from<=period_to)
);
alter table public.finance_reports enable row level security;
revoke all on public.finance_reports from anon, authenticated;
grant select,insert on public.finance_reports to authenticated;
drop policy if exists "administrators read financial reports" on public.finance_reports;
create policy "administrators read financial reports" on public.finance_reports for select to authenticated using(public.is_admin());
drop policy if exists "administrators insert financial reports" on public.finance_reports;
create policy "administrators insert financial reports" on public.finance_reports for insert to authenticated with check(public.is_admin());
