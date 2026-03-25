-- Migration: Add class knowledge fields
-- Run this in your Supabase SQL editor or via the Supabase CLI.
--
-- These columns are all nullable so existing classes continue
-- working with no data change required.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS syllabus_text  text,
  ADD COLUMN IF NOT EXISTS class_notes    text,
  ADD COLUMN IF NOT EXISTS is_ap_course   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ap_course_key  text;
