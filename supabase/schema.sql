-- Marginalia — Supabase schema
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
