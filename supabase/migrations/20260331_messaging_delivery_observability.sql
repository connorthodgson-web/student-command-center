alter table public.messaging_messages
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists provider_last_status text,
  add column if not exists provider_status_updated_at timestamptz;

create index if not exists messaging_messages_provider_status_updated_at_idx
  on public.messaging_messages (provider_status_updated_at desc nulls last);

update public.messaging_messages
set attempt_count = case
  when direction = 'outbound' and (delivery_status in ('processing', 'queued', 'sent', 'delivered', 'failed')) then 1
  else 0
end
where attempt_count = 0;
