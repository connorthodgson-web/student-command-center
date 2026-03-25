create extension if not exists "pgcrypto";

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  teacher_name text,
  teacher_email text,
  notes text,
  room text,
  color text,
  days text[],
  start_time text,
  end_time text,
  meetings jsonb,
  schedule_label text check (schedule_label in ('A', 'B')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists classes_user_id_created_at_idx
  on public.classes (user_id, created_at);

alter table public.classes enable row level security;

create policy "Users can read their own classes"
  on public.classes
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own classes"
  on public.classes
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own classes"
  on public.classes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own classes"
  on public.classes
  for delete
  using (auth.uid() = user_id);
