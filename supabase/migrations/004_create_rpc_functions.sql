-- RPC functions for draft room operations
-- These handle create/join in single transactions to avoid RLS recursion issues

-- Drop existing functions first
DROP FUNCTION IF EXISTS create_draft_room_v2(text,jsonb,text,integer);
DROP FUNCTION IF EXISTS join_draft_by_code_v2(text,text);

-- Create draft room with host participant in one transaction
CREATE OR REPLACE FUNCTION create_draft_room_v2(
  p_display_name TEXT,
  p_settings JSONB,
  p_draft_type TEXT,
  p_team_count INTEGER
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  host_user_id UUID,
  status TEXT,
  settings JSONB,
  snapshot JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  draft_config JSONB,
  draft_type TEXT,
  team_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_id UUID;
  v_room_code TEXT;
  v_user_id UUID := auth.uid();
  v_attempts INTEGER := 0;
BEGIN
  -- Generate unique room code
  LOOP
    v_room_code := (
      SELECT string_agg(substr(chars, (random() * length(chars) + 1)::integer, 1), '')
      FROM (
        SELECT 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' AS chars
      ) t
      WHERE generate_series(1, 6) IS NOT NULL
    );
    
    EXIT WHEN NOT EXISTS (SELECT 1 FROM drafts WHERE code = v_room_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique room code after 10 attempts';
    END IF;
  END LOOP;
  
  -- Create draft
  INSERT INTO drafts (
    code,
    host_user_id,
    status,
    settings,
    draft_config,
    draft_type,
    team_count
  ) VALUES (
    v_room_code,
    v_user_id,
    'lobby',
    p_settings,
    p_settings,
    p_draft_type,
    p_team_count
  ) RETURNING id INTO v_draft_id;
  
  -- Add host as participant
  INSERT INTO draft_participants (
    draft_id,
    user_id,
    display_name,
    is_host,
    is_ready,
    team_number
  ) VALUES (
    v_draft_id,
    v_user_id,
    p_display_name,
    TRUE,
    FALSE,
    1
  );
  
  -- Return the created draft
  RETURN QUERY
  SELECT d.*
  FROM drafts d
  WHERE d.id = v_draft_id;
END;
$$;

-- Join draft by code with participant creation
CREATE OR REPLACE FUNCTION join_draft_by_code_v2(
  p_code TEXT,
  p_display_name TEXT
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  host_user_id UUID,
  status TEXT,
  settings JSONB,
  snapshot JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  draft_config JSONB,
  draft_type TEXT,
  team_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_id UUID;
  v_user_id UUID := auth.uid();
  v_team_number INTEGER;
BEGIN
  -- Get draft and lock it
  SELECT id INTO v_draft_id
  FROM drafts
  WHERE code = p_code AND status = 'lobby'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft room not found or not in lobby status';
  END IF;
  
  -- Check if user already joined
  IF EXISTS (
    SELECT 1 FROM draft_participants 
    WHERE draft_id = v_draft_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User already joined this draft';
  END IF;
  
  -- Get next team number
  SELECT COALESCE(MAX(team_number), 0) + 1 INTO v_team_number
  FROM draft_participants
  WHERE draft_id = v_draft_id;
  
  -- Add participant
  INSERT INTO draft_participants (
    draft_id,
    user_id,
    display_name,
    is_host,
    is_ready,
    team_number
  ) VALUES (
    v_draft_id,
    v_user_id,
    p_display_name,
    FALSE,
    FALSE,
    v_team_number
  );
  
  -- Return the draft
  RETURN QUERY
  SELECT d.*
  FROM drafts d
  WHERE d.id = v_draft_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_draft_room_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION join_draft_by_code_v2 TO authenticated;
