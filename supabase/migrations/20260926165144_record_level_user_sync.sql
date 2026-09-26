-- Move app data from user_app_state JSON into independently mergeable records.
-- The legacy table remains available so existing users can be migrated safely.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) <= 30)
);

create table public.workout_templates (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  template_id text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.body_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.active_workout (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_migrated_at timestamptz,
  active_deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index body_entries_user_date_idx on public.body_entries (user_id, date desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'workout_templates', 'workouts', 'body_entries',
    'user_settings', 'active_workout', 'user_sync_state'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end
$$;
