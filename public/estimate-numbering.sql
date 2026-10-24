-- Execute no SQL Editor do Supabase. Repetível; não renumera orçamentos anteriores.
begin;
create table if not exists public.estimate_number_counter (
 id boolean primary key default true check(id), last_value integer not null check(last_value between 0 and 999999)
);
insert into public.estimate_number_counter values(true,0) on conflict do nothing;
create table if not exists public.estimate_number_reservations (
 quote_id uuid primary key, quote_number text not null unique,
 sequence_value integer not null unique check(sequence_value between 1 and 999999)
);
alter table public.estimate_number_counter enable row level security;
alter table public.estimate_number_reservations enable row level security;
revoke all on public.estimate_number_counter,public.estimate_number_reservations from anon,authenticated;
create or replace function public.reserve_estimate_number(p_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; result text;
begin
 if public.is_admin() is not true then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_id is null then raise exception 'Quote ID required'; end if;
 -- One shared lock serializes reservations, including simultaneous retries for one ID.
 select last_value into n from public.estimate_number_counter where id=true for update;
 select quote_number into result from public.issued_quotes where id=p_id;
 if result is not null then return result; end if;
 select quote_number into result from public.estimate_number_reservations where quote_id=p_id;
 if result is not null then return result; end if;
 loop
  n:=n+1;
  if n>999999 then raise exception 'Six digit quote sequence exhausted'; end if;
  result:='PM-'||to_char(now() at time zone 'America/Sao_Paulo','YYYYMMDD')||'-'||lpad(n::text,6,'0');
  exit when not exists(select 1 from public.issued_quotes where quote_number=result);
 end loop;
 insert into public.estimate_number_reservations values(p_id,result,n);
 update public.estimate_number_counter set last_value=n where id=true;
 return result;
end $$;
revoke all on function public.reserve_estimate_number(uuid) from public,anon;
grant execute on function public.reserve_estimate_number(uuid) to authenticated;
commit;
