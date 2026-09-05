---
version: alpha
name: Fantasy Football presented by GameHQ
description: Interface rules for the fantasy-football application.
colors:
  primary: "{colors.verde-bosco}"
  verde-bosco: "#365A43"
  ruggine: "#9C4F31"
  sabbia: "#D8C6A8"
  grigio-fumo: "#353A38"
  paper: "#F5EEE3"
  green-50: "#F0F4EE"
  green-100: "#DCE7DC"
  green-200: "#BFD1C0"
  green-300: "#9DB89F"
  green-400: "#78997F"
  green-500: "#56775F"
  green-600: "{colors.verde-bosco}"
  green-700: "#2E4C39"
  green-800: "#263F30"
  green-900: "#1E3226"
  green-950: "#17261D"
  rust-50: "#FAF0EA"
  rust-100: "#F0BDA6"
  rust-200: "#E2A083"
  rust-300: "#C77D5D"
  rust-400: "#B66343"
  rust-500: "{colors.ruggine}"
  rust-600: "#814128"
  rust-700: "#6A3522"
  rust-800: "#51291C"
  rust-900: "#3B2119"
  gray-50: "{colors.paper}"
  gray-100: "#E9DDCA"
  gray-200: "{colors.sabbia}"
  gray-300: "#B9B09F"
  gray-400: "#96968E"
  gray-500: "#646963"
  gray-600: "#545954"
  gray-700: "#454A46"
  gray-800: "{colors.grigio-fumo}"
  gray-900: "#292E2B"
  gray-950: "#171A18"
  color-surface-page: "{colors.verde-bosco}"
  color-surface-header: "{colors.gray-800}"
  color-surface-card-primary: "{colors.green-900}"
  color-surface-card-secondary: "{colors.green-800}"
  color-surface-card-tertiary: "green-800 to green-700 mix"
  color-surface-warm: "{colors.sabbia}"
  color-surface-warm-subtle: "18% Sabbia into green-900"
  color-surface-overlay: "gray-900 to green-950 mix"
  color-surface-field: "gray-900 to green-950 mix"
  color-surface-field-hover: "gray-800 to green-800 mix"
  color-surface-field-disabled: "gray-900 to gray-800 mix"
  color-surface-hover: "green-700 to green-800 mix"
  color-surface-selected: "green-700 to verde-bosco mix"
  color-surface-table-header: "green-950 to gray-900 mix"
  color-surface-table-row: "{colors.green-900}"
  color-surface-table-row-alt: "green-900 to green-800 mix"
  color-surface-table-warm-row: "{colors.sabbia}"
  color-surface-table-warm-row-alt: "90% Sabbia to paper"
  color-surface-table-warm-row-hover: "84% Sabbia to green-300"
  color-surface-badge-neutral: "{colors.gray-700}"
  color-surface-badge-brand: "green-700 to verde-bosco mix"
  color-chart-plot: "{colors.sabbia}"
  color-chart-grid: "16% gray-950"
  color-chart-axis: "{colors.gray-950}"
  color-chart-axis-muted: "{colors.gray-700}"
  color-chart-reference: "62% rust-700"
  color-chart-series-neutral: "{colors.green-700}"
  color-chart-series-neutral-point: "{colors.green-900}"
  color-chart-series-positive: "{colors.green-700}"
  color-chart-series-negative: "status-danger to gray-950 mix"
  color-chart-track: "14% gray-950"
  color-border-subtle: "14% Sabbia"
  color-border-default: "24% Sabbia"
  color-border-strong: "38% warm paper"
  color-border-brand: "58% green-300"
  color-border-on-warm: "24% gray-950"
  color-button-primary-border: "{colors.rust-300}"
  color-text-primary: "{colors.gray-50}"
  color-text-secondary: "{colors.gray-100}"
  color-text-muted: "{colors.gray-200}"
  color-text-disabled: "{colors.gray-300}"
  color-text-on-brand: "{colors.gray-50}"
  color-text-on-warm: "{colors.gray-950}"
  color-text-on-warm-secondary: "{colors.gray-700}"
  color-text-on-warm-accent: "{colors.rust-700}"
  color-text-link: "{colors.rust-100}"
  color-text-link-hover: "{colors.rust-50}"
  color-text-placeholder: "{colors.gray-400}"
  color-button-primary: "{colors.ruggine}"
  color-button-primary-hover: "{colors.rust-600}"
  color-button-primary-text: "{colors.gray-50}"
  color-button-secondary: "{colors.gray-800}"
  color-button-secondary-hover: "{colors.gray-700}"
  color-button-secondary-text: "{colors.gray-50}"
  color-button-quiet-hover: "11% Sabbia"
  color-field-focus: "{colors.rust-300}"
  color-status-success: "{colors.green-200}"
  color-status-warning: "oklch(0.78 0.14 75)"
  color-status-danger: "oklch(0.68 0.19 25)"
  position-qb: "#dc2626"
  position-rb: "#16a34a"
  position-wr: "#2563eb"
  position-te: "#ea580c"
  position-flex: "#0891b2"
  position-k: "#9333ea"
  position-defense: "#4b5563"
  position-bench: "{colors.gray-500}"
  position-ir: "{colors.gray-700}"
  position-dl: "{colors.green-800}"
  position-lb: "{colors.green-600}"
  position-db: "{colors.gray-400}"
  position-idp-flex: "{colors.green-300}"
typography:
  sans:
    fontFamily: "Manrope, IBM Plex Sans, Fira Sans, Noto Sans, sans-serif"
  display:
    fontFamily: "Teko, Oswald, Impact, sans-serif"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  pageHero: "clamp(22px, 2.4vw, 34px)"
  pageGap: "clamp(32px, 4vw, 52px)"
  sectionGap: "clamp(24px, 3vw, 36px)"
  panelPadding: "clamp(16px, 1.8vw, 22px)"
  cardPadding: "clamp(14px, 1.5vw, 20px)"
---

## Overview

Fantasy Football presented by GameHQ is a dark, information-dense workspace for drafts, league management, history, and research tools. Verde Bosco (`#365A43`) is the dominant product color, Grigio Fumo (`#353A38`) establishes the shared header, Ruggine (`#9C4F31`) identifies primary actions, and Sabbia (`#D8C6A8`) warms the neutral hierarchy. State changes remain legible through complete container boundaries.

## Colors

Use the Verde Bosco ramp for the page canvas, cards, active navigation, selection, connected state, and success so green remains more prominent than gray across every route. Use Grigio Fumo for the shared header, quiet controls, fields, menus, and overlays. Sabbia must own deliberate, visibly substantial warm surfaces: split-hero copy panels, source or methodology explanations, attribution panels, subdued summary bands, and the designated dense research matrices. It is not merely a text or border tint. Keep dense controls, general-purpose tables, and selected states green or Fumo so the interface remains green-led; the Stats Hub research table and Schedule Lab matchup matrix are deliberate Sabbia exceptions. Use the Ruggine ramp for primary button fills, action links, warm-surface accents, and focus emphasis; the exact default primary-button fill is `#9C4F31`.

Blue, cyan, teal, and navy-blue surfaces are not general interface colors. This prohibition applies to backgrounds, cards, fields, borders, buttons, tabs, badges, charts, glows, and illustrations used as interface chrome. The canonical WR blue and FLEX cyan markers are position semantics, not general accents. Official team artwork may retain authentic brand colors, but those colors never transfer to the surrounding interface.

Reserve gold for awards and milestones, red for danger and errors, and amber for warnings. Those semantic exceptions and Ruggine actions do not displace Verde Bosco as the dominant brand and canvas color.

Charts and graphs use exact Sabbia as the plot-area background, including full scatter-plot fields, ranked-bar fields, and compact sparkline canvases. Gridlines, axes, tick labels, reference lines, and neutral series use contrast-safe dark green, ink, gray, or Ruggine roles on top of Sabbia. Position-coded points and legends keep the canonical position colors, while positive, warning, and negative marks keep their semantic colors. Sabbia is the canvas, not the plotted data.

The Stats Hub research table uses exact Sabbia as its continuous body background. Alternating and hover body rows remain within the warm Sabbia family, while its column header stays on the shared dark table-header surface. All body labels, values, dividers, rank pills, and trend lines switch to their contrast-safe dark roles; helmets and position semantics keep their canonical colors.

The Schedule Lab matchup matrix uses Sabbia only for the graph-like data canvas across the rank, team, summary, and weekly matchup body cells. Its column header stays on the shared dark table-header surface, while alternating and hover body rows remain within the Sabbia family and use dark on-warm dividers and labels. Favorable, neutral, tough, unknown, and bye states retain distinct text labels and contrast-safe semantic text colors without replacing the Sabbia cell background.

## Components

The page background uses the page surface. The header and navigation use the header surface. Primary cards are outer page sections and main work areas. Secondary cards are nested summaries, metrics, roster rows, table groups, and supporting content inside a primary card. Tertiary cards are limited to a third nested layer such as an inset metric inside a secondary card. Warm surfaces use exact Sabbia with the named dark text and border roles; the subtle warm surface may be used for compact supporting bands that must retain light text.

Text inputs, numeric inputs, textareas, and select triggers use the shared Fumo field surface, default border, placeholder, hover, disabled, and Ruggine focus roles. Menus and modals use the overlay surface. Toolbars use the primary-card toolbar role. Selected options, navigation items, tabs, table rows, and toggles use the Bosco selected surface and brand border.

Primary buttons use the shared Ruggine primary-button roles on every page. Secondary buttons use the Fumo secondary-button roles. Quiet and ghost buttons are transparent until hover, and danger buttons use the danger role only for destructive actions.

Tables use the table-header role, primary table-row role, alternate-row role, and shared hover role. Neutral badges use the neutral badge surface; product, connected, live, and success badges use the brand badge surface. Informational messages use a dark green card with a green icon rather than a separate information color.

Primary text, secondary text, muted text, disabled text, placeholder text, links, and on-brand text each use their named shared role. Borders use subtle, default, strong, or brand roles according to hierarchy; page-local border colors are not allowed.

Position identity uses one canonical semantic palette: quarterback red, running back green, wide receiver blue, tight end orange, flex cyan, kicker purple, defense slate, and bench or reserve gray. Every position encoding—including badges, chart points and legends, select swatches, filters, roster lanes, borders, and glows—consumes the shared `--pos-*` tokens through `src/ui/positionColors.ts`; badges use `src/ui/PositionBadge.tsx`. A standalone position badge uses its canonical semantic color as an opaque fill with the shared contrast-safe foreground; feature-level modifiers may change its geometry and typography but must not tint, mix, fade, replace the fill, or force a foreground. Contextual surfaces may tint only a base token returned by `positionColorVar()`. Numbered slots and provider aliases normalize before styling, so `RB1`, `WR3`, `BN2`, `DEF`, and `D/ST` resolve to their base semantic roles. Position text or abbreviations remain visible so meaning never depends on color alone.

Draft pages use the draft editorial image, research and tools pages use the research editorial image, and league, history, and This Week pages use the league editorial image. Images support page identity and remain readable beneath the shared dark-to-green overlay. Photography is darkened or desaturated when necessary so a blue cast does not become an interface surface.

Selected, active, warning, and position states must style the whole owning container. Use a complete border, a uniform surface change, or text and icon color.

Compound fields must read as one control. Prefixes, suffixes, and values share one border and one clipped surface; nested inputs stay transparent when the parent owns the field shell.

Editable numeric fields use one shared stepper: a compact green-accented up/down chevron control inset at the right edge of the shared field surface, with separate accessible increment and decrement hit regions.

Select fields use the shared custom select trigger and its single down chevron; do not expose browser-native select arrows or recreate chevrons with page-local CSS. Numeric and select chevrons use the shared control glyph, sit inside a square inset icon well, and are centered on both axes. Compact roster controls may reduce the well size, but they keep the same glyph, centering, field surface, and accessible label.

## No AI slop

This is a binding product rule. Do not use generic AI-looking imagery or templated AI interface treatments anywhere in FFAA. Prohibited treatments include hand-drawn decorative SVG scenes, cartoon or clip-art sports diagrams, fake dashboard mockups, repetitive equal-card grids, generic proof tiles, decorative pills, invented metrics, slogan-heavy filler copy, and decorative highlighted sides or accent rails on cards.

Use purposeful, route-specific editorial photography, approved brand or team artwork, and real product content. Preserve approved imagery unless the user explicitly asks to replace it. If no suitable asset exists, leave a clearly identified asset requirement instead of fabricating placeholder art.

Selection, activity, status, position, and emphasis must never be shown with a highlighted side of a card. Style the full perimeter, full surface, text, or icon instead. Before reconciling concurrent branches or promoting a release, compare visual-asset paths and selected-state CSS with the approved version so stale placeholder art and one-sided accents cannot overwrite it.

## Density and typography

This is an information-dense product, not a poster. Layouts must maximize useful information without crowding controls or reducing ordinary body copy below 16px.

Use the shared density roles in `src/styles/tokens.css`. The landing display is capped by `--type-display-hero` at 4.75rem. Normal page titles are capped by `--type-display-page` at 3.75rem. Section and card titles use their smaller named roles. Do not add a page-local viewport clamp that exceeds those caps.

Page heroes and cards use natural height. Do not add `min-height` merely to make a surface feel substantial, and do not vertically center short content inside a tall empty container. A minimum height is allowed only when it protects an interaction, visualization, media aspect ratio, loading skeleton, or explicitly designed empty state.

Every section must earn its height with useful content, interaction, or necessary media. Large blank regions inside heroes, cards, panels, and split layouts are a layout defect, even when they are intended to feel dramatic or premium. Fix the underlying composition by reducing minimum height, padding, heading size, gaps, media height, or unbalanced columns. Never use empty canvas, oversized type, or decorative spacing to disguise a low-information section.

Desktop pages should use the available shared content width. At a 900px-tall desktop viewport, the complete primary hero, its main action, and at least one complete useful follow-up group should normally be visible without scrolling. Supporting images use an aspect ratio rather than a fixed tall height.

Group by proximity before adding another card. Use the compact spacing roles for card padding and related groups, the section role between separate tasks, and the page role only between page chapters. Repeated cards in one row may match height, but one card must not force unrelated rows or sections to reserve empty space.

On wide landing pages, independent feature chapters may use two equal columns with secondary-card surfaces. Collapse them to one column before image, title, or body-copy measures become cramped, and keep the DOM reading order unchanged.

Repeated editable data belongs in one compact list or table shell. On desktop, use shared column headers, single-line controls, and row dividers; do not turn every record into a padded card or repeat the same visible field labels in every row. At wide desktop widths, pack independent records into two or more columns before letting the editor consume most of the viewport. A common 10-12-record single-line editor should occupy roughly 250-350px vertically, not merely fit inside a 900px-tall viewport. Preserve explicit labels and full-size controls when the layout stacks on mobile.

## League History evidence

League History completeness uses the canonical states `complete`, `partial`, `missing`, `unknown`, and `not applicable`. Every status is derived from persisted evidence and a documented denominator or invariant. Provider lifecycle values such as `complete` are source metadata only and never establish historical completeness by themselves. Public History and commissioner History Health consume the same coverage manifest, with observed and expected counts shown whenever both are known.

Draft Receipts are auditable outcomes for recorded, non-keeper auction purchases. They show the price, observed roster weeks on the drafting franchise, starter points, raw points per dollar, and comparison sample. Missing weekly evidence remains unavailable rather than becoming zero. Cross-season price bands are normalized to each season's team budget; keepers remain separate from paid-purchase efficiency.

Manager Draft DNA is descriptive, not a grade or recommendation. It may show position allocation, price-band allocation, top-three spend share, observed starter points per dollar, and repeat targets. Partial inputs must say `Provisional`; small comparison populations suppress percentiles. Do not infer injury-adjusted value, steals or reaches, nomination behavior, bid timing, or live-draft advice without the corresponding historical source and an approved methodology.

Roster Legacy counts only stored `WeeklyPlayerResult` rows marked as starters and connects them to permanent manager identity through the recorded weekly roster and season franchise. Position leaders rank by recorded starts, then observed starter points, then player name. Missing points remain unavailable rather than zero, incomplete weekly-player coverage is labeled `Provisional`, and roster-slot assignment or historical NFL-team affiliation must not be inferred from the current payload.

## Do's and Don'ts

- Do use a full perimeter border when color identifies a position or state.
- Do use the semantic color roles from `src/styles/tokens.css` for every shared surface, control, and text role.
- Do keep Verde Bosco dominant across page canvases, cards, navigation, and selected states.
- Do give Sabbia ownership of a visible surface region on landing, source, methodology, or attribution layouts.
- Do use exact Sabbia for every chart and graph plot-area background, including compact sparkline canvases.
- Do use Sabbia for the Stats Hub research-table body and the Schedule Lab graph-like data body, including alternating rows, hover state, and sticky body cells; keep their column headers on the shared dark table-header surface.
- Do use the shared Ruggine role for every primary button across every page.
- Do use the named text, border, badge, table, overlay, toolbar, and status roles for their matching elements.
- Do map outer and nested cards to the primary-card and secondary-card roles.
- Do use the canonical position palette through the shared position utility and badge primitive.
- Do render every standalone position badge with the exact opaque semantic position fill.
- Do use the shared contrast-safe foreground for every filled position badge.
- Do keep every field fill, border, and focus treatment clipped to one control shell.
- Do use the shared numeric stepper for every editable number field.
- Do use the shared custom select trigger and centered control glyph for every visible select field.
- Do use the named display, page, section, panel, and card density roles.
- Do keep page heroes and ordinary cards at natural height.
- Do verify the complete hero and at least one complete useful follow-up group fit in a 900px-tall desktop viewport.
- Do shrink padding, gaps, type, media, and container height when a section leaves visibly unused space.
- Do use one compact list or table shell for repeated editable records on desktop.
- Do preserve approved route imagery through branch reconciliation and release promotion.
- Do communicate clickability through clear labels, hierarchy, borders, underlines, and hover or focus states.
- Do not use blue, cyan, teal, or navy-blue for general interface chrome; WR blue and FLEX cyan are the explicit position-marker exceptions.
- Do not synthesize position CSS classes from raw labels or add page-local position color maps.
- Do not tint, alpha-mix, or surface-mix a standalone position badge's semantic fill.
- Do not recolor position-coded chart points or legends to Sabbia; keep their canonical semantic colors and visible abbreviations.
- Do not use Sabbia for a plotted line or mark when the chart already uses Sabbia as its background.
- Do not hard-code position colors in charts, legends, SVG marks, select swatches, borders, or glows.
- Do not sample an official team or editorial-image color into interface chrome.
- Do not create a page-local primary-action color or substitute an arbitrary orange for Ruggine.
- Do not hard-code a new green, rust, sand, or gray when an existing ramp step or semantic role fits.
- Do not reduce Sabbia to text and border tint while every substantial surface remains green or gray.
- Do not use decorative left-edge stripes, left-only borders, inset left bars, or left-edge pseudo-elements to indicate selection, activity, status, position, or emphasis.
- Do not replace approved imagery with generic AI-looking, hand-drawn, decorative, or placeholder artwork.
- Do not give a nested input its own fill when the parent already owns the field surface.
- Do not expose browser-native number arrows or omit the shared stepper from an editable number field.
- Do not expose browser-native select arrows, draw page-local CSS chevrons, or offset a field glyph by eye.
- Do not use oversized viewport-relative headings as the primary source of hierarchy.
- Do not add empty height, padding, or spacer elements to make a page feel more important.
- Do not leave large blank regions in heroes, cards, panels, or split columns for visual drama.
- Do not wrap every repeated data row in its own padded card or repeat identical desktop field labels row after row.
- Do not append decorative right-arrow icons or glyphs to buttons, links, feature rows, navigation links, or calls to action. Directional icons are reserved for controls where direction is the actual meaning; chevrons remain appropriate for disclosure and dropdown state.
