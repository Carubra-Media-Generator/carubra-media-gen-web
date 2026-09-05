-- Drop existing table to recreate with correct structure
DROP TABLE IF EXISTS public.content_analysis CASCADE;

-- Create table with correct structure
CREATE TABLE public.content_analysis (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  platform text NOT NULL,
  target_audience text,
  content_type text,
  status text NOT NULL,
  analysis_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_content_analysis_user_id ON public.content_analysis (user_id);
CREATE INDEX idx_content_analysis_status ON public.content_analysis (status);
CREATE INDEX idx_content_analysis_created_at ON public.content_analysis (created_at DESC);
