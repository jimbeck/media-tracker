-- auth.users -> profiles bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  candidate_handle text;
  meta_handle text;
begin
  meta_handle := lower(nullif(new.raw_user_meta_data->>'handle', ''));
  base_handle := 'user_' || left(new.id::text, 8);
  candidate_handle := coalesce(meta_handle, base_handle);

  if meta_handle is not null and exists (
    select 1 from profiles p where p.handle = meta_handle
  ) then
    raise exception 'Handle already taken';
  end if;

  while exists (select 1 from profiles p where p.handle = candidate_handle) loop
    candidate_handle := base_handle || '_' || substring(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into profiles (id, handle, display_name, discoverable)
  values (new.id, candidate_handle, 'New User', true);

  insert into profile_private (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
