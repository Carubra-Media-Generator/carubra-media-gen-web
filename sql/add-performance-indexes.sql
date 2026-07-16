-- ============================================================
-- PERFORMANCE INDEXES FOR ADMIN DASHBOARD
-- Run this in your Supabase SQL Editor to fix query timeouts.
-- ============================================================

-- ── images table ─────────────────────────────────────────────
-- Missing indexes causing 40+ second timeouts on admin/contents
CREATE INDEX IF NOT EXISTS idx_images_created_at  ON public.images (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_user_id     ON public.images (user_id);
CREATE INDEX IF NOT EXISTS idx_images_status      ON public.images (status);

-- ── generated_contents table ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_generated_contents_created_at ON public.generated_contents (created_at DESC);

-- ── users table ──────────────────────────────────────────────
-- Needed for fast aggregate filtering (admin count, banned count, membership count)
CREATE INDEX IF NOT EXISTS idx_users_role            ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_banned       ON public.users (is_banned);
CREATE INDEX IF NOT EXISTS idx_users_membership_order ON public.users (membership_order);
CREATE INDEX IF NOT EXISTS idx_users_created_at      ON public.users (created_at DESC);

-- ── ai_usage_logs table ──────────────────────────────────────
-- Already has idx_ai_usage_logs_created_at, adding user_id index
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs (user_id);

-- ── videos table ─────────────────────────────────────────────
-- Already has idx_videos_user_id, idx_videos_status from create-videos-table.sql
-- Adding created_at index for ORDER BY queries
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos (created_at DESC);
