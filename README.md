# FFAA (Auction Draft Assistant)

A Vite + React app for running a fantasy-style auction draft with a live draft board, player pool, and results.

## Tech
- Vite + React + TypeScript
- Chakra UI
- Zustand (state)
- Vitest (tests)

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

## App Flow

1) Setup

Configure league settings (teams, roster slots, scoring presets if present).

Load ADP (Average Draft Position) data (optional).

2) Draft Board

Nominate a player.

Assign the player to a team roster slot.

Slot assignment uses a Position/Slot picker when multiple valid roster slots exist.

If exactly one slot is valid, it auto-assigns.

3) Auctioneer (if enabled)

Run bids and settle the winning team + price.

Draft state updates the board and team rosters.

4) Results

Review final rosters, spend, and draft recap.

## ADP Data (FantasyFootballCalculator)

This app can load ADP data via the FantasyFootballCalculator API.

In development, API calls use the Vite proxy path: /ffc-api

You can override the API base with:

```
VITE_FFC_API_BASE=/ffc-api
```

(For production, point VITE_FFC_API_BASE to your own proxy endpoint if needed.)
