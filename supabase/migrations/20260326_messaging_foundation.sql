create extension if not exists "pgcrypto";

create table if not exists public.messaging_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel_type text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key text,
  address text not null,
  label text,
  is_active boolean not null default true,
  verified_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists messaging_endpoints_channel_address_idx
  on public.messaging_endpoints (channel_type, address);

create index if not exists messaging_endpoints_user_id_idx
  on public.messaging_endpoints (user_id, created_at desc);

alter table public.messaging_endpoints enable row level security;

drop policy if exists "Users can read their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can read their own messaging endpoints"
  on public.messaging_endpoints
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can insert their own messaging endpoints"
  on public.messaging_endpoints
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can update their own messaging endpoints"
  on public.messaging_endpoints
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging endpoints" on public.messaging_endpoints;
create policy "Users can delete their own messaging endpoints"
  on public.messaging_endpoints
  for delete
  using (auth.uid() = user_id);

drop trigger if exists messaging_endpoints_set_updated_at on public.messaging_endpoints;
create trigger messaging_endpoints_set_updated_at
  before update on public.messaging_endpoints
  for each row
  execute function public.set_updated_at();

create table if not exists public.messaging_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint_id uuid references public.messaging_endpoints (id) on delete set null,
  channel_type text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key text,
  status text not null default 'active' check (status in ('active', 'archived')),
  participant_address text,
  assistant_address text,
  title text,
  provider_thread_id text,
  external_reference text,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists messaging_conversations_user_id_idx
  on public.messaging_conversations (user_id, last_message_at desc nulls last, created_at desc);

create index if not exists messaging_conversations_endpoint_id_idx
  on public.messaging_conversations (endpoint_id, updated_at desc);

alter table public.messaging_conversations enable row level security;

drop policy if exists "Users can read their own messaging conversations" on public.messaging_conversations;
create policy "Users can read their own messaging conversations"
  on public.messaging_conversations
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging conversations" on public.messaging_conversations;
create policy "Users can insert their own messaging conversations"
  on public.messaging_conversations
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging conversations" on public.messaging_conversations;
create policy "Users can update their own messaging conversations"
  on public.messaging_conversations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging conversations" on public.messaging_conversations;
create policy "Users can delete their own messaging conversations"
  on public.messaging_conversations
  for delete
  using (auth.uid() = user_id);

drop trigger if exists messaging_conversations_set_updated_at on public.messaging_conversations;
create trigger messaging_conversations_set_updated_at
  before update on public.messaging_conversations
  for each row
  execute function public.set_updated_at();

create table if not exists public.messaging_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.messaging_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel_type text not null check (channel_type in ('sms', 'web', 'email', 'test')),
  provider_key text,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  author_role text not null check (author_role in ('user', 'assistant', 'system')),
  delivery_status text not null default 'received' check (delivery_status in ('received', 'processing', 'queued', 'sent', 'delivered', 'failed')),
  content text not null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
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
  on public.messaging_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own messaging messages" on public.messaging_messages;
create policy "Users can insert their own messaging messages"
  on public.messaging_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own messaging messages" on public.messaging_messages;
create policy "Users can update their own messaging messages"
  on public.messaging_messages
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messaging messages" on public.messaging_messages;
create policy "Users can delete their own messaging messages"
  on public.messaging_messages
  for delete
  using (auth.uid() = user_id);
