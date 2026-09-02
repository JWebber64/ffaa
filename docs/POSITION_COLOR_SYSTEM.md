# Position color system

Football position color is one product-wide semantic system. This contract applies to every position-bearing surface, not only badges.

## Canonical roles

| Position | Fill token | Fill | Badge foreground |
| --- | --- | --- | --- |
| QB | `--pos-qb` | `#dc2626` | light |
| RB | `--pos-rb` | `#16a34a` | dark |
| WR | `--pos-wr` | `#2563eb` | light |
| TE | `--pos-te` | `#ea580c` | dark |
| FLEX and superflex aliases | `--pos-flex` | `#0891b2` | dark |
| K | `--pos-k` | `#9333ea` | light |
| DST and DEF aliases | `--pos-dst` | `#4b5563` | light |
| Bench and taxi aliases | `--pos-bench` | `--gray-500` | light |
| IR and reserve aliases | `--pos-ir` | `--gray-700` | light |
| DL | `--pos-dl` | `--green-800` | light |
| LB | `--pos-lb` | `--green-600` | light |
| DB | `--pos-db` | `--gray-400` | dark |
| IDP flex | `--pos-idpflex` | `--green-500` | dark |

Light and dark foregrounds are owned by `--pos-foreground-light` and `--pos-foreground-dark` in `src/styles/tokens.css`. The chosen pairs meet WCAG AA 4.5:1 for the small badge text.

## Implementation rules

1. Normalize every provider label with `positionColorKey()` and obtain its base color with `positionColorVar()` from `src/ui/positionColors.ts`.
2. Use `PositionBadge` when the abbreviation appears inside a filled marker. The component owns its exact opaque fill and foreground; feature CSS owns only geometry and typography.
3. Chart points, SVG marks, legends, select swatches, roster borders, glows, and tinted containers must derive from `positionColorVar()`. Never create a page-local position palette or generic fallback color.
4. Tints are allowed only for contextual containers. A standalone badge is never alpha-mixed with its surface.
5. Keep the position text visible with every colored encoding. Color is reinforcement, not the only label.
6. Numbered slots and aliases must normalize before styling: `RB1` to RB, `WR3` to WR, `BN2` to bench, `D/ST` to DST, and `IDP_FLEX` to IDP flex.

## Regression checks

Run:

```powershell
npx vitest run src/__tests__/positionColorSystem.test.tsx src/__tests__/positionToggle.test.tsx src/__tests__/positionSelectionConsistency.test.ts src/__tests__/visualSystemTokens.test.ts
```

The guard must fail when runtime code introduces an object literal keyed by multiple football positions, position-specific CSS selectors use the wrong token, a filled badge overrides the shared foreground, or a chart bypasses `positionColorVar()`.

Before Production, inspect computed styles on desktop and mobile for:

- Analytics chart points and legends
- Build a Team player rows and roster configuration
- Rate My Team filters and selected players
- Auction Values filters and position badges
- Stats filters, including K and DEF URL state
- Offline Draft setup, team board, numbered slots, bench, and IR
- League players, teams, lineup, matchups, and My Team when data is available
- Hosted draft player lists, nomination controls, mobile manager roster, and team detail panels

Verify the exact Production asset and confirm that the deployed chart chunk no longer contains a local position palette.
