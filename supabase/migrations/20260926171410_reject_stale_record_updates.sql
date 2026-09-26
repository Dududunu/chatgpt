-- Make timestamp conflict resolution atomic at the database boundary.
-- A delayed upsert from an older device must not overwrite a newer row.
create or replace function public.keep_newest_record_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at <= old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.keep_newest_record_version() from public, anon, authenticated;

create trigger profiles_keep_newest_version
  before update on public.profiles
  for each row execute function public.keep_newest_record_version();
create trigger workout_templates_keep_newest_version
  before update on public.workout_templates
  for each row execute function public.keep_newest_record_version();
create trigger workouts_keep_newest_version
  before update on public.workouts
  for each row execute function public.keep_newest_record_version();
create trigger body_entries_keep_newest_version
  before update on public.body_entries
  for each row execute function public.keep_newest_record_version();
create trigger user_settings_keep_newest_version
  before update on public.user_settings
  for each row execute function public.keep_newest_record_version();
create trigger active_workout_keep_newest_version
  before update on public.active_workout
  for each row execute function public.keep_newest_record_version();
create trigger user_sync_state_keep_newest_version
  before update on public.user_sync_state
  for each row execute function public.keep_newest_record_version();
