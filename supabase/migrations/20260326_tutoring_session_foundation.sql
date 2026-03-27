alter table public.assistant_sessions
  add column if not exists tutoring_mode text
    check (tutoring_mode in ('explain', 'step_by_step', 'quiz', 'review', 'study_plan', 'homework_help')),
  add column if not exists topic text,
  add column if not exists goal text,
  add column if not exists study_focus text;

update public.assistant_sessions
set
  tutoring_mode = coalesce(tutoring_mode, nullif(tutoring_context ->> 'mode', '')),
  topic = coalesce(topic, nullif(tutoring_context ->> 'topic', '')),
  goal = coalesce(goal, nullif(tutoring_context ->> 'goal', '')),
  study_focus = coalesce(study_focus, nullif(tutoring_context ->> 'studyFocus', ''))
where tutoring_context <> '{}'::jsonb;

create index if not exists assistant_sessions_tutoring_mode_idx
  on public.assistant_sessions (user_id, tutoring_mode, updated_at desc);

create index if not exists assistant_sessions_topic_idx
  on public.assistant_sessions (user_id, topic, updated_at desc);
