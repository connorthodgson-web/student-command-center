alter table public.class_materials
  add column if not exists extraction_status text,
  add column if not exists extraction_error text;
