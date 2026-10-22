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
