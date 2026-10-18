-- Execute DEPOIS de 001_platform.sql. Bucket privado, nunca público.
create table public.download_files (
 id uuid primary key, filename text not null check(length(filename) between 1 and 180), model_id text not null default '' check(model_id ~ '^[a-zA-Z0-9_-]{0,60}$'), product_id uuid,
 format text not null check(format in('svg','dxf','pdf','stl','json','zip','eml')),size_bytes integer not null check(size_bytes between 0 and 26214400),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),object_path text not null unique,state text not null default 'pending' check(state in('pending','ready')),created_at timestamptz not null default now()
);
create index on public.download_files(created_at);
alter table public.download_files enable row level security;
revoke all on public.download_files from anon,authenticated;
grant select,delete on public.download_files to authenticated;
create policy "admin reads archived downloads" on public.download_files for select to authenticated using(public.is_admin());
create policy "admin deletes archived downloads" on public.download_files for delete to authenticated using(public.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('maker-downloads','maker-downloads',false,26214400,array['application/octet-stream']);
create function public.reserve_download(p_id uuid,p_filename text,p_model text,p_format text,p_size integer,p_sha256 text,p_product uuid default null) returns void language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtext('papeled-download-reservations'));
 if not public.is_admin() and ((select count(*) from public.download_files where created_at>now()-interval '1 minute')>=20 or (select count(*) from public.download_files where created_at>now()-interval '1 day')>=100) then raise exception 'Archive quota reached';end if;
 insert into public.download_files(id,filename,model_id,product_id,format,size_bytes,sha256,object_path) values(p_id,p_filename,p_model,p_product,p_format,p_size,p_sha256,p_id::text||'/file.'||p_format);
end; $$;
create function public.can_upload_download(p_path text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.download_files where object_path=p_path and state='pending' and created_at>now()-interval '10 minutes'); $$;
create policy "upload reserved downloads only" on storage.objects for insert to anon,authenticated with check(bucket_id='maker-downloads' and public.can_upload_download(name));
create policy "admin reads private downloads" on storage.objects for select to authenticated using(bucket_id='maker-downloads' and public.is_admin());
create policy "admin deletes private downloads" on storage.objects for delete to authenticated using(bucket_id='maker-downloads' and public.is_admin());
create function public.complete_download(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.download_files d set state='ready' where d.id=p_id and d.state='pending' and d.created_at>now()-interval '10 minutes' and exists(select 1 from storage.objects o where o.bucket_id='maker-downloads' and o.name=d.object_path and (o.metadata->>'size')::bigint=d.size_bytes);
 if not found then raise exception 'Archive upload not confirmed';end if;
end; $$;
revoke all on function public.reserve_download(uuid,text,text,text,integer,text,uuid),public.can_upload_download(text),public.complete_download(uuid) from public;
grant execute on function public.reserve_download(uuid,text,text,text,integer,text,uuid),public.can_upload_download(text),public.complete_download(uuid) to anon,authenticated;
