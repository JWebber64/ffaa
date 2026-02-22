-- Add draft configuration columns to drafts table
DO $$
BEGIN
  -- Only add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drafts' 
    AND column_name = 'draft_config'
  ) THEN
    ALTER TABLE public.drafts ADD COLUMN draft_config JSONB NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drafts' 
    AND column_name = 'draft_type'
  ) THEN
    ALTER TABLE public.drafts ADD COLUMN draft_type TEXT NOT NULL DEFAULT 'auction' CHECK (draft_type IN ('auction', 'snake'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drafts' 
    AND column_name = 'team_count'
  ) THEN
    ALTER TABLE public.drafts ADD COLUMN team_count INTEGER NOT NULL DEFAULT 12 CHECK (team_count IN (8, 10, 12, 14, 16));
  END IF;
END $$;

-- Create indexes for new columns (IF NOT EXISTS is safe for indexes)
CREATE INDEX IF NOT EXISTS idx_drafts_config ON public.drafts USING GIN (draft_config);
CREATE INDEX IF NOT EXISTS idx_drafts_type ON public.drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_drafts_team_count ON public.drafts(team_count);
