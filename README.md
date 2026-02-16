# FFAA (Auction Draft Assistant)

A Vite + React app for running a fantasy-style auction draft with a live draft board, player pool, and results. Supports multiplayer real-time drafting via Supabase.

## Tech
- Vite + React + TypeScript
- Chakra UI
- Zustand (state)
- Vitest (tests)
- Supabase (multiplayer realtime)

## Local Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Tests:

```bash
npm run test
```

## Multiplayer Setup (Required for /host, /join, /ping)

### 1. Supabase Environment Variables

Create a `.env` file with:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase Database Setup

**IMPORTANT**: Do NOT re-run table creation scripts if tables already exist.

In Supabase Dashboard → SQL Editor, run only the corrected RLS policies from `supabase/migrations/002_rls_policies.sql`.

### 3. Enable Anonymous Authentication

In Supabase Dashboard → Authentication → Providers, enable "Anonymous" sign-ins.

### 4. Multiplayer Flow

1. **Host**: Open `/host` → Create room → Keep tab open (host processes actions)
2. **Managers**: Open `/join` → Enter room ID → Join draft
3. **Test**: Use `/ping` to send test actions to verify connectivity

## App Flow

### 1) Setup

Configure league settings (teams, roster slots, scoring presets if present).

Load ADP (Average Draft Position) data (optional).

### 2) Draft Board

Nominate a player.

Assign the player to a team roster slot.

Slot assignment uses a Position/Slot picker when multiple valid roster slots exist.

If exactly one slot is valid, it auto-assigns.

### 3) Auctioneer (if enabled)

Run bids and settle the winning team + price.

Draft state updates the board and team rosters.

### 4) Results

Review final rosters, spend, and draft recap.

## ADP Data (FantasyFootballCalculator)

This app can load ADP data via the FantasyFootballCalculator API.

In development, API calls use the Vite proxy path: /ffc-api

You can override the API base with:

```
VITE_FFC_API_BASE=/ffc-api
```

(For production, point VITE_FFC_API_BASE to your own proxy endpoint if needed.)
