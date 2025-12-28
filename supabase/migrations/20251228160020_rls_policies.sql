-- Row Level Security (RLS)
alter table profiles enable row level security;
alter table profile_private enable row level security;
alter table friendships enable row level security;
alter table user_media enable row level security;
alter table lists enable row level security;
alter table list_members enable row level security;
alter table list_items enable row level security;

-- profiles policies
create policy profiles_select_discoverable_or_self
on profiles for select
to authenticated
using (discoverable = true or id = auth.uid());

create policy profiles_insert_self
on profiles for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_self
on profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- profile_private policies
create policy profile_private_select_self_or_friends
on profile_private for select
to authenticated
using (user_id = auth.uid() or are_friends(auth.uid(), user_id));

create policy profile_private_insert_self
on profile_private for insert
to authenticated
with check (user_id = auth.uid());

create policy profile_private_update_self
on profile_private for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- friendships policies
create policy friendships_select_involved
on friendships for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_insert_requester_pending
on friendships for insert
to authenticated
with check (requester_id = auth.uid() and status = 'pending');

create policy friendships_update_involved
on friendships for update
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_delete_involved
on friendships for delete
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

-- user_media policies
create policy user_media_select_self_or_friends
on user_media for select
to authenticated
using (user_id = auth.uid() or are_friends(auth.uid(), user_id));

create policy user_media_insert_self
on user_media for insert
to authenticated
with check (user_id = auth.uid());

create policy user_media_update_self
on user_media for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy user_media_delete_self
on user_media for delete
to authenticated
using (user_id = auth.uid());

-- lists policies
create policy lists_select_readable
on lists for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from list_members lm
    where lm.list_id = lists.id
      and lm.user_id = auth.uid()
  )
  or visibility = 'public'
);

create policy lists_insert_owner
on lists for insert
to authenticated
with check (owner_id = auth.uid());

create policy lists_update_owner
on lists for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy lists_delete_owner
on lists for delete
to authenticated
using (owner_id = auth.uid());

-- list_members policies
create policy list_members_select_owner_or_member
on list_members for select
to authenticated
using (
  exists (
    select 1
    from lists l
    where l.id = list_members.list_id
      and l.owner_id = auth.uid()
  )
  or list_members.user_id = auth.uid()
);

create policy list_members_insert_owner
on list_members for insert
to authenticated
with check (
  exists (
    select 1
    from lists l
    where l.id = list_members.list_id
      and l.owner_id = auth.uid()
  )
);

create policy list_members_update_owner
on list_members for update
to authenticated
using (
  exists (
    select 1
    from lists l
    where l.id = list_members.list_id
      and l.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from lists l
    where l.id = list_members.list_id
      and l.owner_id = auth.uid()
  )
);

create policy list_members_delete_owner
on list_members for delete
to authenticated
using (
  exists (
    select 1
    from lists l
    where l.id = list_members.list_id
      and l.owner_id = auth.uid()
  )
);

-- list_items policies
create policy list_items_select_readable
on list_items for select
to authenticated
using (
  exists (
    select 1
    from lists l
    where l.id = list_items.list_id
      and (
        l.owner_id = auth.uid()
        or l.visibility = 'public'
        or exists (
          select 1
          from list_members lm
          where lm.list_id = list_items.list_id
            and lm.user_id = auth.uid()
        )
      )
  )
);

create policy list_items_insert_owner_or_editor
on list_items for insert
to authenticated
with check (
  exists (
    select 1
    from lists l
    where l.id = list_items.list_id
      and (
        l.owner_id = auth.uid()
        or exists (
          select 1
          from list_members lm
          where lm.list_id = list_items.list_id
            and lm.user_id = auth.uid()
            and lm.role in ('owner', 'editor')
        )
      )
  )
);

create policy list_items_delete_owner_or_editor
on list_items for delete
to authenticated
using (
  exists (
    select 1
    from lists l
    where l.id = list_items.list_id
      and (
        l.owner_id = auth.uid()
        or exists (
          select 1
          from list_members lm
          where lm.list_id = list_items.list_id
            and lm.user_id = auth.uid()
            and lm.role in ('owner', 'editor')
        )
      )
  )
);
