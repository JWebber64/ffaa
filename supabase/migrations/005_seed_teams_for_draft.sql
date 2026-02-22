-- Create draft_teams table first
CREATE TABLE IF NOT EXISTS public.draft_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  budget INTEGER NOT NULL DEFAULT 200,
  spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each team number is unique within a draft
  UNIQUE(draft_id, team_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_draft_teams_draft_id ON public.draft_teams(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_teams_team_number ON public.draft_teams(team_number);

-- Enable RLS
ALTER TABLE public.draft_teams ENABLE ROW LEVEL SECURITY;

-- Create draft_roster table for tracking players on teams
CREATE TABLE IF NOT EXISTS public.draft_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.draft_teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  nfl_team TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  nominated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each player can only be on one team per draft
  UNIQUE(draft_id, player_id)
);

-- Create indexes for roster
CREATE INDEX IF NOT EXISTS idx_draft_roster_draft_id ON public.draft_roster(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_roster_team_id ON public.draft_roster(team_id);
CREATE INDEX IF NOT EXISTS idx_draft_roster_player_id ON public.draft_roster(player_id);

-- Enable RLS
ALTER TABLE public.draft_roster ENABLE ROW LEVEL SECURITY;

-- Seed 12 teams for each draft when created
-- This migration adds default teams that will be available for new drafts

-- Create a function to seed teams for a draft
CREATE OR REPLACE FUNCTION seed_draft_teams(draft_uuid UUID)
RETURNS VOID AS $$
DECLARE
    team_names TEXT[] := ARRAY[
        'Thunder Hawks', 'Steel Titans', 'Golden Eagles', 'Shadow Wolves',
        'Fire Dragons', 'Ice Bears', 'Storm Ravens', 'Rock Lions',
        'Lightning Bolts', 'Cobras', 'Vipers', 'Panthers'
    ];
    i INTEGER;
BEGIN
    -- Insert 12 teams for the draft
    FOR i IN 1..12 LOOP
        INSERT INTO draft_teams (
            draft_id,
            team_number,
            team_name,
            budget,
            spent,
            created_at
        ) VALUES (
            draft_uuid,
            i,
            team_names[i],
            200, -- Default budget
            0,   -- No money spent initially
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically seed teams when a draft is created
CREATE OR REPLACE FUNCTION auto_seed_teams()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the seed function for the new draft
    PERFORM seed_draft_teams(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS on_draft_created_seed_teams ON drafts;
CREATE TRIGGER on_draft_created_seed_teams
    AFTER INSERT ON drafts
    FOR EACH ROW
    EXECUTE FUNCTION auto_seed_teams();

-- Note: Backfill section removed since teams already exist
-- New drafts will be auto-seeded via trigger

-- Create a view for easy access to team data with roster info
CREATE OR REPLACE VIEW draft_teams_with_roster AS
SELECT 
    dt.*,
    COALESCE(roster.player_count, 0) as roster_count,
    COALESCE(roster.total_spent, 0) as calculated_spent
FROM draft_teams dt
LEFT JOIN (
    SELECT 
        team_id,
        COUNT(*) as player_count,
        COALESCE(SUM(price), 0) as total_spent
    FROM draft_roster
    GROUP BY team_id
) roster ON dt.id = roster.team_id;
