-- Foundation migration: classes table.
--
-- The original classes schema lived in docs/supabase/classes-schema.sql and was
-- applied manually in early dev, but was never registered as a migration.
-- That means running the migrations folder from scratch would fail because later
-- migrations (tasks, class_materials) reference public.classes as a foreign key.
--
-- This migration supersedes docs/supabase/classes-schema.sql and absorbs the
-- incremental column additions from:
--   - add_class_knowledge.sql          (syllabus_text, class_notes, is_ap_course, ap_course_key)
--   - 20260326_align_classes_schema.sql (rotation_days + backfill from schedule_label)
--
-- Every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- Safe to run against a brand-new database or one that already has a partial classes table.

create extension if not exists "pgcrypto";

-- Shared trigger function used by multiple tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Core classes table.
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

-- Add all columns introduced in later patches (idempotent).
alter table public.classes
  add column if not exists syllabus_text text,
  add column if not exists class_notes   text,
  add column if not exists is_ap_course  boolean default false,
  add column if not exists ap_course_key text,
  add column if not exists rotation_days text[];

-- Back-fill rotation_days from schedule_label for any existing rows.
update public.classes
set rotation_days = array[schedule_label]
where rotation_days is null
  and schedule_label in ('A', 'B');

create index if not exists classes_user_id_created_at_idx
  on public.classes (user_id, created_at);

alter table public.classes enable row level security;

drop policy if exists "Users can read their own classes" on public.classes;
create policy "Users can read their own classes"
  on public.classes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own classes" on public.classes;
create policy "Users can insert their own classes"
  on public.classes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own classes" on public.classes;
create policy "Users can update their own classes"
  on public.classes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own classes" on public.classes;
create policy "Users can delete their own classes"
  on public.classes
  for delete
  using (auth.uid() = user_id);
