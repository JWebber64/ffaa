-- Drafts table - stores draft room information
CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'settings', 'live', 'paused', 'complete')),
  settings JSONB DEFAULT '{}',
  snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for room code lookups
CREATE INDEX IF NOT EXISTS idx_drafts_code ON public.drafts(code);

-- Draft participants table - stores who has joined each draft
CREATE TABLE IF NOT EXISTS public.draft_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  team_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each user can only join a draft once
  UNIQUE(draft_id, user_id)
);

-- Create indexes for participant lookups
CREATE INDEX IF NOT EXISTS idx_draft_participants_draft_id ON public.draft_participants(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_participants_user_id ON public.draft_participants(user_id);

-- Draft actions table - stores all actions that managers send
CREATE TABLE IF NOT EXISTS public.draft_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  action_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for action lookups
CREATE INDEX IF NOT EXISTS idx_draft_actions_draft_id ON public.draft_actions(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_actions_created_at ON public.draft_actions(created_at);

-- Enable RLS
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_actions ENABLE ROW LEVEL SECURITY;
