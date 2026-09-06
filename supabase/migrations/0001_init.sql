-- ═══════════════════════════════════════════════════════════════
-- Habit App — Supabase schema (replaces Firestore)
--
-- Apply: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Safe to re-run (idempotent-ish: uses IF NOT EXISTS / ON CONFLICT).
-- ═══════════════════════════════════════════════════════════════

-- ─── PROFILES ────────────────────────────────────────────────
-- One row per auth user. Created automatically by a trigger on signup;
-- the app then fills in name + department.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'Friend',
  email       text,
  department  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── HABITS ──────────────────────────────────────────────────
create table if not exists public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  frequency        text not null default 'daily',           -- 'daily' | 'custom'
  scheduled_days   text[] not null default array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  icon             text not null default '✨',
  reminder_enabled boolean not null default false,
  reminder_time    text default '08:00',
  gcal_event_id    text,
  target_value     numeric,
  unit             text,
  created_at       timestamptz not null default now()
);
create index if not exists habits_user_id_idx on public.habits(user_id);

-- ─── LOGS ────────────────────────────────────────────────────
-- `log_date` is the Bangkok calendar day (YYYY-MM-DD) the check-in counts for.
-- `logged_at` is the real timestamp of the tap (used for the "early bird" badge).
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null,
  status     text not null,                                 -- 'done' | 'missed'
  partial    jsonb,
  logged_at  timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists logs_user_id_idx  on public.logs(user_id);
create index if not exists logs_habit_id_idx on public.logs(habit_id);

-- ─── APP CONFIG (department list) ────────────────────────────
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('departments', jsonb_build_object('list', jsonb_build_array(
    'WHA - Domestics Warehouse',
    'WHA - Export Warehouse',
    'WHA - Logistics System and Admin',
    'WHA - Transport Department',
    'WHA - HR Department',
    'WHA - Projects & Safety',
    'WHA - Raw Material WH',
    'WH Chiangmai',
    'WH Chiangrai',
    'WH Phitsanulok',
    'WH Hadyai',
    'WH Surath',
    'WH Khonkan',
    'WH Korath',
    'WH Ubon',
    'WH Ratchburi',
    'WH Sriracha',
    'BKKWH Nongkam',
    'BKKWH Saimai',
    'BKKWH Ladprow',
    'BKKWH Pakkret',
    'BKKWH Wangnoi'
  )))
on conflict (key) do nothing;

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, department)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'Friend'),
    nullif(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.habits     enable row level security;
alter table public.logs       enable row level security;
alter table public.app_config enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A user must NOT be able to make themselves admin. A column-level REVOKE is a
-- no-op while a table-level grant exists, so we drop the table-wide INSERT/UPDATE
-- grants and re-grant only the safe columns. `is_admin` is then writable only by
-- service_role (the console, the migration script) or a SECURITY DEFINER function.
revoke insert, update on public.profiles from authenticated, anon;
grant  insert (id, name, email, department) on public.profiles to authenticated;
grant  update (name, email, department)     on public.profiles to authenticated;

-- habits: full CRUD on your own rows only.
drop policy if exists habits_all_own on public.habits;
create policy habits_all_own on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- logs: full CRUD on your own rows only.
drop policy if exists logs_all_own on public.logs;
create policy logs_all_own on public.logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- app_config: everyone (even signed-out, for the register screen) can read;
-- only admins can write.
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select using (true);

drop policy if exists app_config_admin_write on public.app_config;
create policy app_config_admin_write on public.app_config
  for all
  using  (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ─── REALTIME ───────────────────────────────────────────────
-- Let the client subscribe to its own habit/log changes.
do $$
begin
  alter publication supabase_realtime add table public.habits;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.logs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.app_config;
exception when duplicate_object then null;
end $$;
