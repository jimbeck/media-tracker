-- updated_at triggers
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on profiles
for each row
execute function set_updated_at();

create trigger friendships_set_updated_at
before update on friendships
for each row
execute function set_updated_at();

create trigger media_items_set_updated_at
before update on media_items
for each row
execute function set_updated_at();

create trigger user_media_set_updated_at
before update on user_media
for each row
execute function set_updated_at();

create trigger lists_set_updated_at
before update on lists
for each row
execute function set_updated_at();
