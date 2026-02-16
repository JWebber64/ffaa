-- Add draft configuration columns to drafts table
ALTER TABLE public.drafts 
ADD COLUMN draft_config JSONB NOT NULL DEFAULT '{}',
ADD COLUMN draft_type TEXT NOT NULL DEFAULT 'auction' CHECK (draft_type IN ('auction', 'snake')),
ADD COLUMN team_count INTEGER NOT NULL DEFAULT 12 CHECK (team_count IN (8, 10, 12, 14, 16));

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_drafts_config ON public.drafts USING GIN (draft_config);
CREATE INDEX IF NOT EXISTS idx_drafts_type ON public.drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_drafts_team_count ON public.drafts(team_count);
