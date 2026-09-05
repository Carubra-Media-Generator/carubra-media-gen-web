-- Migration: Update scheduled_posts table to match application expectations.
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / ALTER COLUMN DEFAULT).

-- Add missing columns for the full scheduled posts feature
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS platforms jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS media_name text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS post_types jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS scheduled_date text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS scheduled_time text;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS media_source text DEFAULT 'upload';
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS generated_video_id uuid;
ALTER TABLE public.scheduled_posts ADD COLUMN IF NOT EXISTS generated_image_id uuid;

-- Ensure updated_at has the correct default
ALTER TABLE public.scheduled_posts ALTER COLUMN updated_at SET DEFAULT now();
