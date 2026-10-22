-- Atualiza somente a validação de novos cadastros. Preserva todos os registros anteriores.
create or replace function public.register_customer_project(p_id uuid,p_name text,p_phone text,p_email text,p_action text,p_project jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 180 or p_phone is null or length(p_phone)>40 or p_email is null or length(p_email)>180 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_action is null or p_action not in('save','export','quote') or p_project is null or jsonb_typeof(p_project)<>'object' or octet_length(p_project::text)>120000 or coalesce(length(p_project->>'model'),0) not between 1 and 80 then raise exception 'Invalid customer project';end if;
 insert into public.customer_projects(id,customer_name,phone,email,action,project) values(p_id,trim(p_name),trim(p_phone),trim(p_email),p_action,p_project) on conflict(id) do nothing;
end;$$;
