alter table public.assistant_attachments
  add column if not exists file_size_bytes bigint,
  add column if not exists processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'processing', 'completed', 'failed')),
  add column if not exists extraction_error text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.assistant_attachments
set processing_status = case
  when analysis_status = 'failed' then 'failed'
  when analysis_status in ('completed', 'not_requested') then 'completed'
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
  for each row
  execute function public.set_updated_at();
