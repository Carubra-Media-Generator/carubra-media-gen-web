-- OAuth sessions for social media authentication flow
-- Run this in Supabase SQL Editor to fix the social media connection error

CREATE TABLE IF NOT EXISTS public.oauth_sessions (
  state text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  code_verifier text,
  created_at timestamptz DEFAULT now(),
  expired_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_sessions_user_id ON public.oauth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expired_at ON public.oauth_sessions (expired_at);
