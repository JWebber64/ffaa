# Supabase Setup Instructions

## 1. Run Database Migrations

In your Supabase project dashboard:

1. Go to SQL Editor
2. Run `001_create_tables.sql` to create the tables
3. Run `002_rls_policies.sql` to set up security policies

## 2. Verify Environment Variables

Your `.env` file should contain:
```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 3. Test Connection

Start your dev server and test:

1. Visit `/host` - Create a draft room
2. Visit `/join` - Join with the room code
3. Visit `/ping` - Test the realtime pipeline

## 4. Key Tables Created

### `drafts`
- Stores draft room information
- Fields: id, code, host_user_id, status, settings, snapshot, timestamps
- RLS: Users can view drafts they participate in, hosts can update

### `draft_participants`
- Stores who has joined each draft
- Fields: id, draft_id, user_id, display_name, is_host, is_ready, team_number
- RLS: Users can manage their own participation

### `draft_actions`
- Stores all actions that managers send
- Fields: id, draft_id, action_id, user_id, type, payload, created_at
- RLS: Users can insert actions, no updates/deletes (immutable)

## 5. Security Features

- **Row Level Security**: Users can only access drafts they participate in
- **Action Immutability**: Actions cannot be updated or deleted (audit trail)
- **Host Authority**: Only draft hosts can update draft settings
- **Participant Isolation**: Users can only manage their own participation

## 6. Next Development Steps

1. Test the PING endpoint at `/ping`
2. Wire real auction actions (NOMINATE_PLAYER, PLACE_BID, etc.)
3. Add authentication UI (login/signup)
4. Implement auctioneer styles
5. Add host payment/licensing
