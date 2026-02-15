# Multiplayer Auction Plan

## Overview

Transform the existing single-device auction draft into a real-time multiplayer experience supporting 1 host + 11 connected managers.

## Roles

- **Host**: Creates room, controls draft flow, has authority over all actions
- **Manager**: Joins room, participates in bidding and nomination when it's their turn

## Core Concepts

- **Room**: 6-8 character code identifies a draft session
- **Real-time sync**: Host is authoritative, managers send actions, host broadcasts state
- **Auctioneer styles**: Selectable personality packs (Classic, Rodeo, Posh Art House, Comedian)

## Implementation Steps

### Step 0 ✅ Baseline + Guardrails

- [x] Create this plan document
- [ ] Add version stamp in UI footer (app version + git hash)
- [ ] Add VITE_MULTIPLAYER_ENABLED feature flag

### Step 1 - Multiplayer Data Model

- [ ] Add draft store fields: draftId, hostUserId, createdAt, updatedAt, status
- [ ] Create exportDraftState() and importDraftState() functions
- [ ] Add lastMutationId and lastMutationAt for sync ordering

### Step 2 - Authentication

- [ ] Implement Supabase Auth (email magic link or anonymous + upgrade)
- [ ] Add AuthProvider and route guards
- [ ] Ensure stable userId across devices

### Step 3 - Lobby System

- [ ] Create LobbyHost.tsx and LobbyJoin.tsx screens
- [ ] Implement room code generation (6-8 chars)
- [ ] Enforce exactly 12 teams/managers capacity
- [ ] Add "Ready" toggles for each manager

### Step 4 - Real-time State Sync

- [ ] Create DB tables: drafts, draft_participants, draft_actions
- [ ] Implement realtime subscriptions
- [ ] Host authority workflow: actions → validate → apply → broadcast

### Step 5 - Permissions + UI Roles

- [ ] Host-only controls: start/pause draft, edit settings, finalize
- [ ] Manager permissions: bid during live, nominate when it's their turn
- [ ] Add RLS policies for security

### Step 6 - Auction Flow

- [ ] Lock settings on draft start
- [ ] Randomize first nominator, enforce turn order
- [ ] Add nomination window UX with timeouts
- [ ] Show "You are nominating" banner to current nominator

### Step 7 - Bidding UX

- [ ] Add quick bid buttons (+1, +2, +5, +10)
- [ ] Implement "Bid Max" functionality
- [ ] Handle race conditions with host validation
- [ ] Sync current high bidder and time remaining

### Step 8 - Auctioneer Styles

- [ ] Create style interface and implementations
- [ ] Implement phrase libraries for each style
- [ ] Add voice presets and sound packs
- [ ] Wire style selection into settings

### Step 9 - Purchase/Licensing

- [ ] Implement Stripe checkout for host accounts
- [ ] Enforce host payment requirement
- [ ] Allow free manager joins

### Step 10 - Hardening + Recovery

- [ ] Add rejoin room functionality
- [ ] Implement automatic resync on reconnect
- [ ] Add host controls: undo, pause/resume, replace managers
- [ ] Create audit log UI

## Technical Architecture

- **Store Strategy**: Wrap existing draftStore.ts with multiplayer sync
- **Sync Pattern**: exportDraftState/importDraftState + actions table + host authority
- **Real-time**: Supabase realtime subscriptions
- **Auth**: Supabase Auth with email magic links

## Success Criteria

- 12 devices can participate simultaneously
- Real-time bidding feels responsive (<200ms latency)
- Host has full control over draft flow
- Managers cannot grief or disrupt the draft
- System survives disconnections and reconnections
