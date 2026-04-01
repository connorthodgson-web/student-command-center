create extension if not exists "pgcrypto";

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type in ('tonight_summary', 'morning_summary', 'due_soon', 'study_reminder', 'class_reminder', 'custom')),
  title text not null,
  schedule_description text not null,
  schedule_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  delivery_channel text not null default 'in_app'
    check (delivery_channel in ('in_app', 'sms')),
  related_class_id uuid references public.classes (id) on delete set null,
  related_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists automations_user_id_created_at_idx
  on public.automations (user_id, created_at desc);

create index if not exists automations_user_id_enabled_idx
  on public.automations (user_id, enabled, updated_at desc);

alter table public.automations enable row level security;

drop policy if exists "Users can read their own automations" on public.automations;
create policy "Users can read their own automations"
  on public.automations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own automations" on public.automations;
create policy "Users can insert their own automations"
  on public.automations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own automations" on public.automations;
create policy "Users can update their own automations"
  on public.automations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own automations" on public.automations;
create policy "Users can delete their own automations"
  on public.automations
  for delete
  using (auth.uid() = user_id);

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row
  execute function public.set_updated_at();

create table if not exists public.planning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('recurring_activity', 'one_off_event')),
  title text not null,
  days_of_week text[],
  date text,
  start_time text,
  end_time text,
  location text,
  notes text,
  is_all_day boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint planning_items_shape check (
    (kind = 'recurring_activity' and coalesce(array_length(days_of_week, 1), 0) > 0 and date is null)
    or
    (kind = 'one_off_event' and date is not null)
  )
);

create index if not exists planning_items_user_id_kind_idx
  on public.planning_items (user_id, kind, created_at desc);

create index if not exists planning_items_user_id_date_idx
  on public.planning_items (user_id, date);

alter table public.planning_items enable row level security;

drop policy if exists "Users can read their own planning items" on public.planning_items;
create policy "Users can read their own planning items"
  on public.planning_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planning items" on public.planning_items;
create policy "Users can insert their own planning items"
  on public.planning_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planning items" on public.planning_items;
create policy "Users can update their own planning items"
  on public.planning_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own planning items" on public.planning_items;
create policy "Users can delete their own planning items"
  on public.planning_items
  for delete
  using (auth.uid() = user_id);

drop trigger if exists planning_items_set_updated_at on public.planning_items;
create trigger planning_items_set_updated_at
  before update on public.planning_items
  for each row
  execute function public.set_updated_at();
