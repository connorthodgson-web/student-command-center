alter table public.messaging_endpoints
  add column if not exists is_preferred boolean not null default false,
  add column if not exists verification_status text not null default 'not_started'
    check (verification_status in ('not_started', 'pending', 'verified', 'failed')),
  add column if not exists verification_code_hash text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_attempt_count integer not null default 0,
  add column if not exists last_verification_sent_at timestamptz;

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
