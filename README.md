# Fantasy Football presented by GameHQ

A Vite + React fantasy-football app with live and offline auction drafts, player analysis, and permanent league history. Firebase is the only application backend.

## Tech
- Vite + React + TypeScript
- Zustand (state)
- Vitest (tests)
- Firebase Authentication and Cloud Firestore

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

## Firebase Setup

Create a `.env` file using the browser configuration for the `ffaa-b7e61` Firebase project:

```dotenv
VITE_MULTIPLAYER_ENABLED=true
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Enable Anonymous Authentication in Firebase Authentication. Deploy the checked-in Firestore rules and indexes with:

```bash
firebase deploy --only firestore --project ffaa-b7e61
```

Firestore stores live draft rooms under `drafts` and permanent history under `leagueHistories`. League History is public read-only; browser writes to that collection are denied. See `docs/FIREBASE_LEAGUE_HISTORY.md` for the guarded import procedure.

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
