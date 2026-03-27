-- Align the classes table with the fields the app currently reads and writes.
-- Run this migration in Supabase before relying on class knowledge or A/B-both rotation storage.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS syllabus_text text,
  ADD COLUMN IF NOT EXISTS class_notes text,
  ADD COLUMN IF NOT EXISTS is_ap_course boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ap_course_key text,
  ADD COLUMN IF NOT EXISTS rotation_days text[];

-- Backfill the new rotation_days column from the legacy single-value schedule_label column.
UPDATE classes
SET rotation_days = ARRAY[schedule_label]
WHERE rotation_days IS NULL
  AND schedule_label IN ('A', 'B');
