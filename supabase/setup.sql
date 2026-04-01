-- =============================================================================
-- Student Command Center — Full Schema Setup
-- =============================================================================
-- Run this entire file in the Supabase SQL Editor to set up (or repair) the
-- complete database schema.  Every statement is idempotent, so it is safe to
-- run against a brand-new project OR against a database that already has some
-- tables applied.
--
-- Migration order (dependency-safe):
--   1. classes             (00000000_classes_foundation.sql)
--   2. tasks / reminder_preferences / class_materials
--                          (20260326_real_data_foundation.sql)
--   3. class_materials extraction columns
--                          (20260326_wave2_material_extraction.sql)
--   4. messaging_*         (20260326_messaging_foundation.sql)
--   5. messaging verification + reminder delivery_channel
--                          (20260326_messaging_verification_and_reminder_delivery.sql)
--   6. assistant_sessions / messages / events / attachments
--                          (20260326_assistant_sessions_and_attachments.sql)
--   7. assistant_attachments processing columns
--                          (20260326_assistant_attachment_processing.sql)
--   8. assistant_sessions tutoring columns
--                          (20260326_tutoring_session_foundation.sql)
--   9. automations / planning_items
--                          (20260327_automations_and_planning_items.sql)
--  10. notes
--                          (20260330_notes_memory.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared infrastructure
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. classes
-- (Fixes error: "Could not find the 'rotation_days' column of 'classes'")
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  teacher_name   text,
  teacher_email  text,
  notes          text,
  room           text,
  color          text,
  days           text[],
  start_time     text,
  end_time       text,
  meetings       jsonb,
  schedule_label text check (schedule_label in ('A', 'B')),
  created_at     timestamptz not null default timezone('utc', now())
);

-- Add all incremental columns (idempotent).
alter table public.classes
  add column if not exists syllabus_text text,
  add column if not exists class_notes   text,
  add column if not exists is_ap_course  boolean default false,
  add column if not exists ap_course_key text,
  add column if not exists rotation_days text[];

-- Back-fill rotation_days from schedule_label for any legacy rows.
update public.classes
set rotation_days = array[schedule_label]
where rotation_days is null
  and schedule_label in ('A', 'B');

create index if not exists classes_user_id_created_at_idx
  on public.classes (user_id, created_at);

alter table public.classes enable row level security;

drop policy if exists "Users can read their own classes" on public.classes;
create policy "Users can read their own classes"
  on public.classes for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own classes" on public.classes;
create policy "Users can insert their own classes"
  on public.classes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own classes" on public.classes;
create policy "Users can update their own classes"
  on public.classes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own classes" on public.classes;
create policy "Users can delete their own classes"
  on public.classes for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. tasks / reminder_preferences / class_materials
-- (Fixes error: "Could not find the table 'public.reminder_preferences'")
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  class_id    uuid references public.classes (id) on delete set null,
  title       text not null,
  description text,
  due_at      timestamptz,
  status      text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  source      text not null default 'manual'
    check (source in ('manual', 'ai-parsed', 'chat', 'imported')),
  type        text check (type in ('assignment', 'test', 'quiz', 'reading', 'project', 'study')),
  reminder_at timestamptz,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists tasks_user_id_due_at_idx  on public.tasks (user_id, due_at);
create index if not exists tasks_user_id_status_idx  on public.tasks (user_id, status);

alter table public.tasks enable row level security;

drop policy if exists "Users can read their own tasks" on public.tasks;
create policy "Users can read their own tasks"
  on public.tasks for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
  on public.tasks for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks for delete using (auth.uid() = user_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table if not exists public.reminder_preferences (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references auth.users (id) on delete cascade,
  daily_summary_enabled     boolean not null default false,
  daily_summary_time        text,
  tonight_summary_enabled   boolean not null default false,
  tonight_summary_time      text,
  due_soon_reminders_enabled boolean not null default false,
  due_soon_hours_before     integer not null default 6,
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

alter table public.reminder_preferences enable row level security;

drop policy if exists "Users can read their own reminder preferences" on public.reminder_preferences;
create policy "Users can read their own reminder preferences"
  on public.reminder_preferences for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reminder preferences" on public.reminder_preferences;
create policy "Users can insert their own reminder preferences"
  on public.reminder_preferences for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reminder preferences" on public.reminder_preferences;
create policy "Users can update their own reminder preferences"
  on public.reminder_preferences for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists reminder_preferences_set_updated_at on public.reminder_preferences;
create trigger reminder_preferences_set_updated_at
  before update on public.reminder_preferences
  for each row execute function public.set_updated_at();

create table if not exists public.class_materials (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  class_id       uuid not null references public.classes (id) on delete cascade,
  kind           text not null check (kind in ('file', 'note')),
  title          text not null,
  file_name      text,
  mime_type      text,
  storage_path   text,
  raw_text       text,
  extracted_text text,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists class_materials_user_id_class_id_idx
  on public.class_materials (user_id, class_id, created_at desc);

alter table public.class_materials enable row level security;

drop policy if exists "Users can read their own class materials" on public.class_materials;
create policy "Users can read their own class materials"
  on public.class_materials for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own class materials" on public.class_materials;
create policy "Users can insert their own class materials"
  on public.class_materials for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own class materials" on public.class_materials;
create policy "Users can delete their own class materials"
  on public.class_materials for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own class material files" on storage.objects;
create policy "Users can read their own class material files"
  on storage.objects for select
  using (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own class material files" on storage.objects;
create policy "Users can upload their own class material files"
  on storage.objects for insert
  with check (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own class material files" on storage.objects;
create policy "Users can delete their own class material files"
  on storage.objects for delete
  using (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3. class_materials extraction columns
-- ---------------------------------------------------------------------------
alter table public.class_materials
  add column if not exists extraction_status text,
  add column if not exists extraction_error  text;

-- ---------------------------------------------------------------------------
-- 4. messaging_endpoints / messaging_conversations / messaging_messages
-- (Fixes error: "Could not find the table 'public.messaging_endpoints'")
-- ---------------------------------------------------------------------------
create table if not exists public.messaging_endpoints (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  channel_type  text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key  text,
  address       text not null,
  label         text,
  is_active     boolean not null default true,
  verified_at   timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create unique index if not exists messaging_endpoints_channel_address_idx
  on public.messaging_endpoints (channel_type, address);

create index if not exists messaging_endpoints_user_id_idx
  on public.messaging_endpoints (user_id, created_at desc);

alter table public.messaging_endpoints enable row level security;

drop policy if exists "Users can read their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can read their own messaging endpoints"
  on public.messaging_endpoints for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can insert their own messaging endpoints"
  on public.messaging_endpoints for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can update their own messaging endpoints"
  on public.messaging_endpoints for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can delete their own messaging endpoints"
  on public.messaging_endpoints for delete using (auth.uid() = user_id);

drop trigger if exists messaging_endpoints_set_updated_at on public.messaging_endpoints;
create trigger messaging_endpoints_set_updated_at
  before update on public.messaging_endpoints
  for each row execute function public.set_updated_at();

create table if not exists public.messaging_conversations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  endpoint_id         uuid references public.messaging_endpoints (id) on delete set null,
  channel_type        text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key        text,
  status              text not null default 'active' check (status in ('active', 'archived')),
  participant_address text,
  assistant_address   text,
  title               text,
  provider_thread_id  text,
  external_reference  text,
  last_message_at     timestamptz,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index if not exists messaging_conversations_user_id_idx
  on public.messaging_conversations (user_id, last_message_at desc nulls last, created_at desc);

create index if not exists messaging_conversations_endpoint_id_idx
  on public.messaging_conversations (endpoint_id, updated_at desc);

alter table public.messaging_conversations enable row level security;

drop policy if exists "Users can read their own messaging conversations" on public.messaging_conversations;
create policy "Users can read their own messaging conversations"
  on public.messaging_conversations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging conversations" on public.messaging_conversations;
create policy "Users can insert their own messaging conversations"
  on public.messaging_conversations for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging conversations" on public.messaging_conversations;
create policy "Users can update their own messaging conversations"
  on public.messaging_conversations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging conversations" on public.messaging_conversations;
create policy "Users can delete their own messaging conversations"
  on public.messaging_conversations for delete using (auth.uid() = user_id);

drop trigger if exists messaging_conversations_set_updated_at on public.messaging_conversations;
create trigger messaging_conversations_set_updated_at
  before update on public.messaging_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.messaging_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.messaging_conversations (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  channel_type        text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key        text,
  provider_message_id text,
  direction           text not null check (direction in ('inbound', 'outbound')),
  author_role         text not null check (author_role in ('user', 'assistant', 'system')),
  delivery_status     text not null default 'received'
    check (delivery_status in ('received', 'processing', 'queued', 'sent', 'delivered', 'failed')),
  content             text not null,
  error_message       text,
  metadata            jsonb not null default '{}'::jsonb,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default timezone('utc', now())
);

create unique index if not exists messaging_messages_provider_message_idx
  on public.messaging_messages (provider_key, provider_message_id)
  where provider_message_id is not null;

create index if not exists messaging_messages_conversation_id_idx
  on public.messaging_messages (conversation_id, created_at asc);

create index if not exists messaging_messages_user_id_idx
  on public.messaging_messages (user_id, created_at desc);

alter table public.messaging_messages enable row level security;

drop policy if exists "Users can read their own messaging messages" on public.messaging_messages;
create policy "Users can read their own messaging messages"
  on public.messaging_messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging messages" on public.messaging_messages;
create policy "Users can insert their own messaging messages"
  on public.messaging_messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging messages" on public.messaging_messages;
create policy "Users can update their own messaging messages"
  on public.messaging_messages for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging messages" on public.messaging_messages;
create policy "Users can delete their own messaging messages"
  on public.messaging_messages for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. messaging verification columns + reminder_preferences.delivery_channel
-- ---------------------------------------------------------------------------
alter table public.messaging_endpoints
  add column if not exists is_preferred                boolean not null default false,
  add column if not exists verification_status         text    not null default 'not_started'
    check (verification_status in ('not_started', 'pending', 'verified', 'failed')),
  add column if not exists verification_code_hash      text,
  add column if not exists verification_expires_at     timestamptz,
  add column if not exists verification_attempt_count  integer not null default 0,
  add column if not exists last_verification_sent_at   timestamptz;

-- Migrate legacy verified_at into new verification_status.
update public.messaging_endpoints
set verification_status = case
  when verified_at is not null then 'verified'
  else 'pending'
end
where verification_status = 'not_started';

update public.messaging_endpoints
set is_active = false
where verified_at is null
  and verification_status <> 'verified';

create unique index if not exists messaging_endpoints_one_preferred_per_channel_idx
  on public.messaging_endpoints (user_id, channel_type)
  where is_preferred = true;

alter table public.reminder_preferences
  add column if not exists delivery_channel text not null default 'in_app'
    check (delivery_channel in ('in_app', 'sms'));

-- ---------------------------------------------------------------------------
-- 6. assistant_sessions / messages / events / attachments
-- ---------------------------------------------------------------------------
create table if not exists public.assistant_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  channel         text not null
    check (channel in ('web_chat', 'voice', 'messaging', 'mobile', 'tutoring')),
  status          text not null default 'active'
    check (status in ('active', 'archived')),
  title           text,
  class_id        uuid references public.classes (id) on delete set null,
  task_id         uuid references public.tasks (id) on delete set null,
  tutoring_context jsonb not null default '{}'::jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_sessions_user_id_idx
  on public.assistant_sessions (user_id, updated_at desc, created_at desc);

create index if not exists assistant_sessions_class_id_idx
  on public.assistant_sessions (class_id, updated_at desc);

alter table public.assistant_sessions enable row level security;

drop policy if exists "Users can read their own assistant sessions" on public.assistant_sessions;
create policy "Users can read their own assistant sessions"
  on public.assistant_sessions for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant sessions" on public.assistant_sessions;
create policy "Users can insert their own assistant sessions"
  on public.assistant_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant sessions" on public.assistant_sessions;
create policy "Users can update their own assistant sessions"
  on public.assistant_sessions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant sessions" on public.assistant_sessions;
create policy "Users can delete their own assistant sessions"
  on public.assistant_sessions for delete using (auth.uid() = user_id);

drop trigger if exists assistant_sessions_set_updated_at on public.assistant_sessions;
create trigger assistant_sessions_set_updated_at
  before update on public.assistant_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.assistant_session_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.assistant_sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('system', 'user', 'assistant')),
  content_type text not null default 'text'
    check (content_type in ('text', 'voice_transcript', 'messaging_text', 'attachment_note')),
  content      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_session_messages_session_id_idx
  on public.assistant_session_messages (session_id, created_at asc);

create index if not exists assistant_session_messages_user_id_idx
  on public.assistant_session_messages (user_id, created_at desc);

alter table public.assistant_session_messages enable row level security;

drop policy if exists "Users can read their own assistant session messages" on public.assistant_session_messages;
create policy "Users can read their own assistant session messages"
  on public.assistant_session_messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant session messages" on public.assistant_session_messages;
create policy "Users can insert their own assistant session messages"
  on public.assistant_session_messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant session messages" on public.assistant_session_messages;
create policy "Users can update their own assistant session messages"
  on public.assistant_session_messages for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant session messages" on public.assistant_session_messages;
create policy "Users can delete their own assistant session messages"
  on public.assistant_session_messages for delete using (auth.uid() = user_id);

create table if not exists public.assistant_session_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.assistant_sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_type  text not null
    check (event_type in (
      'session_started',
      'message_added',
      'assistant_response_generated',
      'attachment_added',
      'tutoring_session_created',
      'voice_transcript_submitted'
    )),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_session_events_session_id_idx
  on public.assistant_session_events (session_id, created_at asc);

alter table public.assistant_session_events enable row level security;

drop policy if exists "Users can read their own assistant session events" on public.assistant_session_events;
create policy "Users can read their own assistant session events"
  on public.assistant_session_events for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant session events" on public.assistant_session_events;
create policy "Users can insert their own assistant session events"
  on public.assistant_session_events for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant session events" on public.assistant_session_events;
create policy "Users can update their own assistant session events"
  on public.assistant_session_events for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant session events" on public.assistant_session_events;
create policy "Users can delete their own assistant session events"
  on public.assistant_session_events for delete using (auth.uid() = user_id);

create table if not exists public.assistant_attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  session_id      uuid references public.assistant_sessions (id) on delete set null,
  message_id      uuid references public.assistant_session_messages (id) on delete set null,
  class_id        uuid references public.classes (id) on delete set null,
  task_id         uuid references public.tasks (id) on delete set null,
  attachment_type text not null
    check (attachment_type in ('image', 'file', 'audio', 'document')),
  title           text not null,
  file_name       text,
  mime_type       text,
  storage_path    text not null,
  extracted_text  text,
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'completed', 'failed', 'not_requested')),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_attachments_user_id_idx
  on public.assistant_attachments (user_id, created_at desc);

create index if not exists assistant_attachments_session_id_idx
  on public.assistant_attachments (session_id, created_at desc);

alter table public.assistant_attachments enable row level security;

drop policy if exists "Users can read their own assistant attachments" on public.assistant_attachments;
create policy "Users can read their own assistant attachments"
  on public.assistant_attachments for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant attachments" on public.assistant_attachments;
create policy "Users can insert their own assistant attachments"
  on public.assistant_attachments for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant attachments" on public.assistant_attachments;
create policy "Users can update their own assistant attachments"
  on public.assistant_attachments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant attachments" on public.assistant_attachments;
create policy "Users can delete their own assistant attachments"
  on public.assistant_attachments for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('assistant-attachments', 'assistant-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own assistant attachments files" on storage.objects;
create policy "Users can read their own assistant attachments files"
  on storage.objects for select
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own assistant attachments files" on storage.objects;
create policy "Users can upload their own assistant attachments files"
  on storage.objects for insert
  with check (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own assistant attachments files" on storage.objects;
create policy "Users can delete their own assistant attachments files"
  on storage.objects for delete
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Link messaging_conversations → assistant_sessions.
alter table public.messaging_conversations
  add column if not exists assistant_session_id uuid
    references public.assistant_sessions (id) on delete set null;

create index if not exists messaging_conversations_assistant_session_id_idx
  on public.messaging_conversations (assistant_session_id);

-- ---------------------------------------------------------------------------
-- 7. assistant_attachments processing columns
-- ---------------------------------------------------------------------------
alter table public.assistant_attachments
  add column if not exists file_size_bytes    bigint,
  add column if not exists processing_status  text not null default 'uploaded'
    check (processing_status in ('uploaded', 'processing', 'completed', 'failed')),
  add column if not exists extraction_error   text,
  add column if not exists updated_at         timestamptz not null default timezone('utc', now());

update public.assistant_attachments
set processing_status = case
  when analysis_status = 'failed'                         then 'failed'
  when analysis_status in ('completed', 'not_requested')  then 'completed'
  else 'uploaded'
end
where processing_status = 'uploaded';

create index if not exists assistant_attachments_class_id_idx
  on public.assistant_attachments (class_id, created_at desc);

create index if not exists assistant_attachments_task_id_idx
  on public.assistant_attachments (task_id, created_at desc);

create index if not exists assistant_attachments_message_id_idx
  on public.assistant_attachments (message_id, created_at desc);

drop trigger if exists assistant_attachments_set_updated_at on public.assistant_attachments;
create trigger assistant_attachments_set_updated_at
  before update on public.assistant_attachments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. assistant_sessions tutoring columns
-- ---------------------------------------------------------------------------
alter table public.assistant_sessions
  add column if not exists tutoring_mode text
    check (tutoring_mode in ('explain', 'step_by_step', 'quiz', 'review', 'study_plan', 'homework_help')),
  add column if not exists topic         text,
  add column if not exists goal          text,
  add column if not exists study_focus   text;

update public.assistant_sessions
set
  tutoring_mode = coalesce(tutoring_mode, nullif(tutoring_context ->> 'mode', '')),
  topic         = coalesce(topic,         nullif(tutoring_context ->> 'topic', '')),
  goal          = coalesce(goal,          nullif(tutoring_context ->> 'goal', '')),
  study_focus   = coalesce(study_focus,   nullif(tutoring_context ->> 'studyFocus', ''))
where tutoring_context <> '{}'::jsonb;

create index if not exists assistant_sessions_tutoring_mode_idx
  on public.assistant_sessions (user_id, tutoring_mode, updated_at desc);

create index if not exists assistant_sessions_topic_idx
  on public.assistant_sessions (user_id, topic, updated_at desc);

-- ---------------------------------------------------------------------------
-- 9. automations / planning_items
-- (Fixes missing tables used by assistant data loading and live planning flows)
-- ---------------------------------------------------------------------------
create table if not exists public.automations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  type              text not null
    check (type in ('tonight_summary', 'morning_summary', 'due_soon', 'study_reminder', 'class_reminder', 'custom')),
  title             text not null,
  schedule_description text not null,
  schedule_config   jsonb not null default '{}'::jsonb,
  enabled           boolean not null default true,
  delivery_channel  text not null default 'in_app'
    check (delivery_channel in ('in_app', 'sms')),
  related_class_id  uuid references public.classes (id) on delete set null,
  related_task_id   uuid references public.tasks (id) on delete set null,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index if not exists automations_user_id_created_at_idx
  on public.automations (user_id, created_at desc);

create index if not exists automations_user_id_enabled_idx
  on public.automations (user_id, enabled, updated_at desc);

alter table public.automations enable row level security;

drop policy if exists "Users can read their own automations" on public.automations;
create policy "Users can read their own automations"
  on public.automations for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own automations" on public.automations;
create policy "Users can insert their own automations"
  on public.automations for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own automations" on public.automations;
create policy "Users can update their own automations"
  on public.automations for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own automations" on public.automations;
create policy "Users can delete their own automations"
  on public.automations for delete using (auth.uid() = user_id);

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

create table if not exists public.planning_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('recurring_activity', 'one_off_event')),
  title         text not null,
  days_of_week  text[],
  date          text,
  start_time    text,
  end_time      text,
  location      text,
  notes         text,
  is_all_day    boolean not null default false,
  enabled       boolean not null default true,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
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
  on public.planning_items for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planning items" on public.planning_items;
create policy "Users can insert their own planning items"
  on public.planning_items for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planning items" on public.planning_items;
create policy "Users can update their own planning items"
  on public.planning_items for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own planning items" on public.planning_items;
create policy "Users can delete their own planning items"
  on public.planning_items for delete using (auth.uid() = user_id);

drop trigger if exists planning_items_set_updated_at on public.planning_items;
create trigger planning_items_set_updated_at
  before update on public.planning_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. notes
-- (Lightweight assistant memory for low-friction note capture)
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null,
  title      text,
  class_id   uuid references public.classes (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notes_user_id_updated_at_idx
  on public.notes (user_id, updated_at desc, created_at desc);

create index if not exists notes_user_id_class_id_idx
  on public.notes (user_id, class_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "Users can read their own notes" on public.notes;
create policy "Users can read their own notes"
  on public.notes for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notes" on public.notes;
create policy "Users can insert their own notes"
  on public.notes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete using (auth.uid() = user_id);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Done.  All tables, indexes, RLS policies, and triggers are now in place.
-- =============================================================================
