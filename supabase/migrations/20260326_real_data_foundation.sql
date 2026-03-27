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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  source text not null default 'manual' check (source in ('manual', 'ai-parsed', 'chat', 'imported')),
  type text check (type in ('assignment', 'test', 'quiz', 'reading', 'project', 'study')),
  reminder_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tasks_user_id_due_at_idx
  on public.tasks (user_id, due_at);

create index if not exists tasks_user_id_status_idx
  on public.tasks (user_id, status);

alter table public.tasks enable row level security;

drop policy if exists "Users can read their own tasks" on public.tasks;
create policy "Users can read their own tasks"
  on public.tasks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
  on public.tasks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks
  for delete
  using (auth.uid() = user_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  daily_summary_enabled boolean not null default false,
  daily_summary_time text,
  tonight_summary_enabled boolean not null default false,
  tonight_summary_time text,
  due_soon_reminders_enabled boolean not null default false,
  due_soon_hours_before integer not null default 6,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.reminder_preferences enable row level security;

drop policy if exists "Users can read their own reminder preferences" on public.reminder_preferences;
create policy "Users can read their own reminder preferences"
  on public.reminder_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reminder preferences" on public.reminder_preferences;
create policy "Users can insert their own reminder preferences"
  on public.reminder_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reminder preferences" on public.reminder_preferences;
create policy "Users can update their own reminder preferences"
  on public.reminder_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists reminder_preferences_set_updated_at on public.reminder_preferences;
create trigger reminder_preferences_set_updated_at
  before update on public.reminder_preferences
  for each row
  execute function public.set_updated_at();

create table if not exists public.class_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  kind text not null check (kind in ('file', 'note')),
  title text not null,
  file_name text,
  mime_type text,
  storage_path text,
  raw_text text,
  extracted_text text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists class_materials_user_id_class_id_idx
  on public.class_materials (user_id, class_id, created_at desc);

alter table public.class_materials enable row level security;

drop policy if exists "Users can read their own class materials" on public.class_materials;
create policy "Users can read their own class materials"
  on public.class_materials
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own class materials" on public.class_materials;
create policy "Users can insert their own class materials"
  on public.class_materials
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own class materials" on public.class_materials;
create policy "Users can delete their own class materials"
  on public.class_materials
  for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', false)
on conflict (id) do nothing;

drop policy if exists "Users can read their own class material files" on storage.objects;
create policy "Users can read their own class material files"
  on storage.objects
  for select
  using (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own class material files" on storage.objects;
create policy "Users can upload their own class material files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own class material files" on storage.objects;
create policy "Users can delete their own class material files"
  on storage.objects
  for delete
  using (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
