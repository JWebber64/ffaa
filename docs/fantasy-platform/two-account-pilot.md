# Native league two-account pilot

This is the final operator gate before enabling native-league features for a broader cohort. Automated tests prove deterministic commands and security rules; they do not replace two distinct people/sessions exercising Firebase identity, invitation delivery, subscriptions, stale-state handling, and mobile UI against one deployed build.

## Preconditions

- Use a Preview deployment for the exact candidate commit. Do not use Production for the first pass.
- Use two distinct Firebase accounts and email addresses: one commissioner and one manager. Use separate browser profiles or devices so auth and local storage cannot bleed between roles.
- Create a dedicated disposable pilot league. Do not attach or migrate a real Sleeper league.
- Record candidate commit, Preview deployment URL/ID, browser versions, viewport/device, account role, start time, and Firebase project before testing.
- From the candidate checkout, pass `npm run pilot:native:preflight` and the normal release verifier first.

## Required journey

| Step | Commissioner session | Manager session | Evidence / pass condition |
|---|---|---|---|
| 1. Create | Create a native redraft league and publish the initial rules. | Stay signed out of the league. | Permanent GameHQ league ID; published settings version; manager cannot discover private controls. |
| 2. Invite | Invite the manager to one franchise. | Open the invitation while signed in as the invited email and accept it. | Email binding enforced; membership and team-owner grant appear once; retry does not duplicate them. |
| 3. Reconnect | Reload in a fresh tab. | Reload in a fresh tab/device. | Both sessions recover the same league, role, team, rules version, and revision without local-only setup. |
| 4. Authority | Open Commissioner and change a draft setting without publishing. | Attempt to open Commissioner and inspect Team. | Manager cannot see or call commissioner mutations; unpublished draft is not active for the manager. |
| 5. Stale write | Open the same league state in a second commissioner tab. | Save a legal lineup from the current revision. | A stale competing save/publish is rejected with a visible refresh path; the winning state is not overwritten. |
| 6. Weekly ops | Publish a waiver deadline and process the due run. | Submit an ordered claim with a legal fallback, then inspect its receipt. | Exactly one outcome, explainable failures, correct FAAB/priority/roster ownership, retry-safe receipt. |
| 7. Trade | Review and complete an eligible two-team trade. | Offer/counter/accept as permitted. | Reserved assets cannot be double-traded; both rosters, receipt, audit, and activity agree. |
| 8. Mobile | Review Home, Team, Transactions, and Commissioner at 390 x 844. | Review Home, Matchup, Team, Players, and More at 390 x 844. | No horizontal overflow; usable focus/touch targets; authority, pending, error, and receipt states remain visible. |
| 9. Revoke | Remove the manager with a written reason. | Refresh and retry a previously allowed action. | Membership becomes removed, grants are revoked, reads/writes follow policy immediately, and the audit remains. |

## Evidence record

Save one short report per run under an ignored local evidence directory or the release ticket. Include:

- exact commit and Preview deployment ID;
- Firebase project and league ID (redact account email/local tokens from shared artifacts);
- screenshots for authority, invitation acceptance, legal lineup, stale conflict, waiver receipt, trade receipt, mobile navigation, and revoked access;
- command/receipt IDs and relevant server logs, with tokens removed;
- pass/fail for every table row and the first failing revision if rerun;
- cleanup performed and any persistent pilot records intentionally retained for audit.

## Stop conditions and cleanup

Stop immediately on cross-account data exposure, a direct client write to authoritative state, duplicate ownership, silent stale overwrite, missing audit/receipt, or a role that survives revocation. Do not broaden the cohort until the fix passes the entire pilot from a new league.

The pilot creates real external state and therefore requires the two account credentials and chosen Firebase/Preview environment from the operator. The automated preflight in this repository is safe to run locally, but it is not evidence that the real two-account pilot has passed.
