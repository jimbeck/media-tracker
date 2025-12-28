-- Extensions
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- Enums
create type media_type as enum ('tv', 'movie', 'game', 'book');
create type media_source as enum ('tmdb', 'igdb', 'openlibrary', 'manual');
create type visibility as enum ('public', 'friends', 'private');
create type member_role as enum ('owner', 'editor', 'viewer');
create type media_status as enum ('planned', 'in_progress', 'completed', 'on_hold', 'dropped');
create type friend_status as enum ('pending', 'accepted', 'blocked');

-- Profiles (public/discoverable stub)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text,
  avatar_url text,
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profile private details (1:1)
create table profile_private (
  user_id uuid primary key references profiles(id) on delete cascade,
  bio text,
  website text,
  location text,
  favorite_types jsonb,
  updated_at timestamptz not null default now()
);

-- Friendships
create table friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status friend_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from friendships f
    where
      ((f.requester_id = a and f.addressee_id = b)
       or (f.requester_id = b and f.addressee_id = a))
      and f.status = 'accepted'
  );
$$;

-- Media items
create table media_items (
  id bigint generated always as identity primary key,
  type media_type not null,
  source media_source not null,
  external_id text not null,
  title text not null,
  description text,
  release_date date,
  poster_url text,
  payload jsonb,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index media_items_title_trgm_idx
  on media_items
  using gin (title gin_trgm_ops);

-- User media
create table user_media (
  user_id uuid not null references profiles(id) on delete cascade,
  media_item_id bigint not null references media_items(id) on delete cascade,
  status media_status,
  rating smallint check (rating between 1 and 10),
  notes text,
  started_at date,
  finished_at date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_item_id)
);

create index user_media_user_id_idx on user_media (user_id);
create index user_media_media_item_id_idx on user_media (media_item_id);
create index user_media_status_idx on user_media (status);

-- Lists
create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  visibility visibility not null default 'public',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table list_members (
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table list_items (
  list_id uuid not null references lists(id) on delete cascade,
  media_item_id bigint not null references media_items(id) on delete cascade,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, media_item_id)
);
