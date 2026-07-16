-- ============================================================
-- RPC FUNCTION: get_ai_usage_totals
-- Used by /api/admin/monitoring to replace the full table scan
-- of SELECT total_tokens FROM ai_usage_logs (no LIMIT).
--
-- Run this in your Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ai_usage_totals()
RETURNS TABLE(total_events bigint, total_tokens bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::bigint        AS total_events,
    COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
  FROM public.ai_usage_logs;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.get_ai_usage_totals() TO service_role;
