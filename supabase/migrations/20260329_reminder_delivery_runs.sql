create extension if not exists "pgcrypto";

create table if not exists public.reminder_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_kind text not null
    check (reminder_kind in ('daily_summary', 'tonight_summary', 'due_soon')),
  dedupe_key text not null,
  scheduled_for timestamptz not null,
  task_id uuid references public.tasks (id) on delete set null,
  automation_id uuid references public.automations (id) on delete set null,
  delivery_channel text not null
    check (delivery_channel in ('in_app', 'sms')),
  delivery_target text,
  delivery_status text not null
    check (delivery_status in ('processing', 'sent', 'skipped', 'failed')),
  content text,
  reason text,
  provider_message_id text,
  messaging_message_id uuid references public.messaging_messages (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists reminder_delivery_runs_dedupe_key_idx
  on public.reminder_delivery_runs (dedupe_key);

create index if not exists reminder_delivery_runs_user_id_attempted_at_idx
  on public.reminder_delivery_runs (user_id, attempted_at desc);

create index if not exists reminder_delivery_runs_scheduled_for_idx
  on public.reminder_delivery_runs (scheduled_for desc);

alter table public.reminder_delivery_runs enable row level security;

drop policy if exists "Users can read their own reminder delivery runs" on public.reminder_delivery_runs;
create policy "Users can read their own reminder delivery runs"
  on public.reminder_delivery_runs
  for select
  using (auth.uid() = user_id);
