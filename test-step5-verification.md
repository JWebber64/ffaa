# Step 5 Verification Checklist

## Implementation Summary
✅ Created useEnsureSupabaseSession hook for anonymous auth
✅ Updated AppShellV2 to ensure session globally with auth status badges
✅ Added missing participant API helpers (getDraftByCode, listParticipants, setMyReady, leaveDraftRoom)
✅ Created useLobbyRoom hook for realtime participants subscription
✅ Wired HostLobbyV2 to real create + participants subscription
✅ Wired JoinLobbyV2 to real join + ready toggle + participants subscription

## Manual Testing Steps

### Host Device Testing
1. Navigate to `/host`
2. Enter display name (e.g., "Commissioner")
3. Click "Create Room"
4. Verify room code appears
5. Verify participants list shows host row (is_host=true, is_ready=true)
6. Copy room code functionality works

### Manager Device Testing  
1. Navigate to `/join`
2. Enter room code + display name
3. Click "Join"
4. Verify lobby view appears with room code
5. Verify participants list updates in realtime on both devices
6. Toggle Ready state on manager device
7. Verify host sees ready state update instantly

### Expected Realtime Behavior
- Participants list updates instantly when someone joins
- Ready state changes propagate immediately
- Host sees correct ready count
- Manager sees their ready status toggle work

### Technical Verification
- Anonymous auth creates user_id automatically
- Supabase drafts table gets populated
- Supabase draft_participants table gets populated
- Realtime subscription to draft_participants works
- Role clarity correct (host vs manager based on draft_participants.is_host)

## Notes for Step 6
- Start Draft button is ready but not wired (will be done in Step 6)
- Manager actions (kick, reassign teams) not implemented yet
- Draft Room routing will be implemented in Step 6
