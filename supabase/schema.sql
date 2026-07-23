-- Tropeology — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ---------------------------------------------------------------
-- Table: user_data
-- Holds books, wishlist, releases, goals, reading log and prefs
-- as a single JSON document per signed-in user.
-- ---------------------------------------------------------------
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own" on public.user_data
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Table: user_calendar
-- Holds the uploaded calendar-export background photo (as a
-- compressed base64 JPEG) and the panel opacity, per user.
-- ---------------------------------------------------------------
create table if not exists public.user_calendar (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  background text,
  opacity    numeric not null default 0.72,
  updated_at timestamptz not null default now()
);

alter table public.user_calendar enable row level security;

drop policy if exists "user_calendar_select_own" on public.user_calendar;
create policy "user_calendar_select_own" on public.user_calendar
  for select using (auth.uid() = user_id);

drop policy if exists "user_calendar_insert_own" on public.user_calendar;
create policy "user_calendar_insert_own" on public.user_calendar
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_calendar_update_own" on public.user_calendar;
create policy "user_calendar_update_own" on public.user_calendar
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_calendar_delete_own" on public.user_calendar;
create policy "user_calendar_delete_own" on public.user_calendar
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Keep updated_at current automatically on every UPDATE.
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.user_data;
create trigger set_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.user_calendar;
create trigger set_updated_at
  before update on public.user_calendar
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Table: releases
-- App-wide "upcoming releases" list. Visible to every signed-in
-- user, but only the app owner (matched by email below) can add,
-- edit, or remove entries. Swap the email if the owner changes.
-- ---------------------------------------------------------------
create table if not exists public.releases (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text,
  cover_url    text,
  blurb        text,
  format       text not null default 'physical',
  release_date date not null,
  created_at   timestamptz not null default now()
);

alter table public.releases add column if not exists blurb text;

alter table public.releases enable row level security;

drop policy if exists "releases_select_all" on public.releases;
create policy "releases_select_all" on public.releases
  for select to authenticated using (true);

drop policy if exists "releases_insert_owner" on public.releases;
create policy "releases_insert_owner" on public.releases
  for insert to authenticated with check (auth.email() = 'xo.apple.xox@gmail.com');

drop policy if exists "releases_update_owner" on public.releases;
create policy "releases_update_owner" on public.releases
  for update to authenticated using (auth.email() = 'xo.apple.xox@gmail.com')
  with check (auth.email() = 'xo.apple.xox@gmail.com');

drop policy if exists "releases_delete_owner" on public.releases;
create policy "releases_delete_owner" on public.releases
  for delete to authenticated using (auth.email() = 'xo.apple.xox@gmail.com');

-- ---------------------------------------------------------------
-- Storage bucket: release-covers
-- Uploaded release cover photos. Publicly readable so every
-- user's browser can display them; only the owner can upload
-- or delete.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('release-covers', 'release-covers', true)
on conflict (id) do nothing;

drop policy if exists "release_covers_select_all" on storage.objects;
create policy "release_covers_select_all" on storage.objects
  for select using (bucket_id = 'release-covers');

drop policy if exists "release_covers_insert_owner" on storage.objects;
create policy "release_covers_insert_owner" on storage.objects
  for insert to authenticated with check (bucket_id = 'release-covers' and auth.email() = 'xo.apple.xox@gmail.com');

drop policy if exists "release_covers_delete_owner" on storage.objects;
create policy "release_covers_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'release-covers' and auth.email() = 'xo.apple.xox@gmail.com');
