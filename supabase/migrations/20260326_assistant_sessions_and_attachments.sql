create extension if not exists "pgcrypto";

create table if not exists public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('web_chat', 'voice', 'messaging', 'mobile', 'tutoring')),
  status text not null default 'active' check (status in ('active', 'archived')),
  title text,
  class_id uuid references public.classes (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  tutoring_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_sessions_user_id_idx
  on public.assistant_sessions (user_id, updated_at desc, created_at desc);

create index if not exists assistant_sessions_class_id_idx
  on public.assistant_sessions (class_id, updated_at desc);

alter table public.assistant_sessions enable row level security;

drop policy if exists "Users can read their own assistant sessions" on public.assistant_sessions;
create policy "Users can read their own assistant sessions"
  on public.assistant_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant sessions" on public.assistant_sessions;
create policy "Users can insert their own assistant sessions"
  on public.assistant_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant sessions" on public.assistant_sessions;
create policy "Users can update their own assistant sessions"
  on public.assistant_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant sessions" on public.assistant_sessions;
create policy "Users can delete their own assistant sessions"
  on public.assistant_sessions
  for delete
  using (auth.uid() = user_id);

drop trigger if exists assistant_sessions_set_updated_at on public.assistant_sessions;
create trigger assistant_sessions_set_updated_at
  before update on public.assistant_sessions
  for each row
  execute function public.set_updated_at();

create table if not exists public.assistant_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content_type text not null default 'text'
    check (content_type in ('text', 'voice_transcript', 'messaging_text', 'attachment_note')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_session_messages_session_id_idx
  on public.assistant_session_messages (session_id, created_at asc);

create index if not exists assistant_session_messages_user_id_idx
  on public.assistant_session_messages (user_id, created_at desc);

alter table public.assistant_session_messages enable row level security;

drop policy if exists "Users can read their own assistant session messages" on public.assistant_session_messages;
create policy "Users can read their own assistant session messages"
  on public.assistant_session_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant session messages" on public.assistant_session_messages;
create policy "Users can insert their own assistant session messages"
  on public.assistant_session_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant session messages" on public.assistant_session_messages;
create policy "Users can update their own assistant session messages"
  on public.assistant_session_messages
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant session messages" on public.assistant_session_messages;
create policy "Users can delete their own assistant session messages"
  on public.assistant_session_messages
  for delete
  using (auth.uid() = user_id);

create table if not exists public.assistant_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'session_started',
        'message_added',
        'assistant_response_generated',
        'attachment_added',
        'tutoring_session_created',
        'voice_transcript_submitted'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_session_events_session_id_idx
  on public.assistant_session_events (session_id, created_at asc);

alter table public.assistant_session_events enable row level security;

drop policy if exists "Users can read their own assistant session events" on public.assistant_session_events;
create policy "Users can read their own assistant session events"
  on public.assistant_session_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant session events" on public.assistant_session_events;
create policy "Users can insert their own assistant session events"
  on public.assistant_session_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant session events" on public.assistant_session_events;
create policy "Users can update their own assistant session events"
  on public.assistant_session_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant session events" on public.assistant_session_events;
create policy "Users can delete their own assistant session events"
  on public.assistant_session_events
  for delete
  using (auth.uid() = user_id);

create table if not exists public.assistant_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.assistant_sessions (id) on delete set null,
  message_id uuid references public.assistant_session_messages (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  attachment_type text not null check (attachment_type in ('image', 'file', 'audio', 'document')),
  title text not null,
  file_name text,
  mime_type text,
  storage_path text not null,
  extracted_text text,
  analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'completed', 'failed', 'not_requested')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists assistant_attachments_user_id_idx
  on public.assistant_attachments (user_id, created_at desc);

create index if not exists assistant_attachments_session_id_idx
  on public.assistant_attachments (session_id, created_at desc);

alter table public.assistant_attachments enable row level security;

drop policy if exists "Users can read their own assistant attachments" on public.assistant_attachments;
create policy "Users can read their own assistant attachments"
  on public.assistant_attachments
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own assistant attachments" on public.assistant_attachments;
create policy "Users can insert their own assistant attachments"
  on public.assistant_attachments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own assistant attachments" on public.assistant_attachments;
create policy "Users can update their own assistant attachments"
  on public.assistant_attachments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own assistant attachments" on public.assistant_attachments;
create policy "Users can delete their own assistant attachments"
  on public.assistant_attachments
  for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('assistant-attachments', 'assistant-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own assistant attachments files" on storage.objects;
create policy "Users can read their own assistant attachments files"
  on storage.objects
  for select
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own assistant attachments files" on storage.objects;
create policy "Users can upload their own assistant attachments files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own assistant attachments files" on storage.objects;
create policy "Users can delete their own assistant attachments files"
  on storage.objects
  for delete
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.messaging_conversations
  add column if not exists assistant_session_id uuid references public.assistant_sessions (id) on delete set null;

create index if not exists messaging_conversations_assistant_session_id_idx
  on public.messaging_conversations (assistant_session_id);
