---
version: alpha
name: Fantasy Football presented by GameHQ
description: Interface rules for the fantasy-football application.
colors:
  primary: "{colors.green-400}"
  green-50: "oklch(0.97 0.025 150)"
  green-100: "oklch(0.93 0.045 150)"
  green-200: "oklch(0.86 0.08 150)"
  green-300: "oklch(0.78 0.125 150)"
  green-400: "oklch(0.7 0.155 150)"
  green-500: "oklch(0.63 0.16 150)"
  green-600: "oklch(0.55 0.145 150)"
  green-700: "oklch(0.46 0.11 150)"
  green-800: "oklch(0.38 0.075 150)"
  green-900: "oklch(0.3 0.045 150)"
  green-950: "oklch(0.22 0.025 150)"
  gray-50: "oklch(0.97 0.006 160)"
  gray-100: "oklch(0.92 0.008 160)"
  gray-200: "oklch(0.84 0.009 160)"
  gray-300: "oklch(0.74 0.011 160)"
  gray-400: "oklch(0.64 0.012 160)"
  gray-500: "oklch(0.54 0.012 160)"
  gray-600: "oklch(0.44 0.012 160)"
  gray-700: "oklch(0.35 0.012 160)"
  gray-800: "oklch(0.27 0.011 160)"
  gray-900: "oklch(0.21 0.009 160)"
  gray-950: "oklch(0.16 0.008 160)"
  color-surface-page: "{colors.gray-950}"
  color-surface-header: "{colors.gray-800}"
  color-surface-card-primary: "{colors.gray-900}"
  color-surface-card-secondary: "{colors.gray-800}"
  color-surface-card-tertiary: "oklch(0.288 0.011 160)"
  color-surface-overlay: "oklch(0.261 0.013 158)"
  color-surface-field: "oklch(0.235 0.01 160)"
  color-surface-field-hover: "{colors.gray-800}"
  color-surface-field-disabled: "oklch(0.22 0.009 160)"
  color-surface-hover: "oklch(0.277 0.018 155)"
  color-surface-selected: "oklch(0.316 0.038 156)"
  color-surface-table-header: "oklch(0.263 0.013 157)"
  color-surface-table-row: "{colors.gray-900}"
  color-surface-table-row-alt: "oklch(0.228 0.009 160)"
  color-surface-badge-neutral: "{colors.gray-700}"
  color-surface-badge-brand: "oklch(0.322 0.044 153)"
  color-border-subtle: "oklch(0.84 0.009 160 / 0.14)"
  color-border-default: "oklch(0.84 0.009 160 / 0.24)"
  color-border-strong: "oklch(0.92 0.008 160 / 0.38)"
  color-border-brand: "oklch(0.7 0.155 150 / 0.58)"
  color-text-primary: "{colors.gray-50}"
  color-text-secondary: "{colors.gray-200}"
  color-text-muted: "{colors.gray-300}"
  color-text-disabled: "{colors.gray-500}"
  color-text-on-brand: "{colors.gray-950}"
  color-text-link: "{colors.green-200}"
  color-text-link-hover: "{colors.green-100}"
  color-text-placeholder: "{colors.gray-400}"
  color-button-primary: "{colors.green-400}"
  color-button-primary-hover: "{colors.green-300}"
  color-button-primary-text: "{colors.gray-950}"
  color-button-secondary: "{colors.gray-800}"
  color-button-secondary-hover: "{colors.gray-700}"
  color-button-secondary-text: "{colors.gray-50}"
  color-button-quiet-hover: "oklch(0.63 0.16 150 / 0.11)"
  color-field-focus: "{colors.green-400}"
  color-status-success: "{colors.green-400}"
  color-status-warning: "oklch(0.78 0.14 75)"
  color-status-danger: "oklch(0.68 0.19 25)"
  position-qb: "{colors.green-700}"
  position-rb: "{colors.green-500}"
  position-wr: "{colors.green-300}"
  position-te: "{colors.green-600}"
  position-flex: "{colors.green-200}"
  position-k: "{colors.gray-300}"
  position-defense: "{colors.gray-600}"
  position-bench: "{colors.gray-500}"
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

Fantasy Football presented by GameHQ is a dark, information-dense workspace for drafts, league management, history, and research tools. Green is the product color, neutral gray establishes interface depth, and state changes remain legible through complete container boundaries.

## Colors

Use the shared green ramp for product actions, active navigation, selection, focus, links, success, and football-position identity. Use the shared gray ramp for the page, primary and secondary cards, fields, menus, toolbars, tables, quiet controls, and reserve positions.

Blue, cyan, teal, and navy-blue surfaces are not interface colors. This prohibition applies to backgrounds, cards, fields, borders, buttons, tabs, badges, charts, glows, and illustrations used as interface chrome. Official team artwork may retain authentic brand colors, but those colors never transfer to the surrounding interface.

Reserve gold for awards and milestones, red for danger and errors, and amber for warnings. Those semantic exceptions do not replace green as the only general product accent.

## Components

The page background uses the page surface. The header and navigation use the header surface. Primary cards are outer page sections and main work areas. Secondary cards are nested summaries, metrics, roster rows, table groups, and supporting content inside a primary card. Tertiary cards are limited to a third nested layer such as an inset metric inside a secondary card.

Text inputs, numeric inputs, textareas, and select triggers use the shared field surface, default border, placeholder, hover, disabled, and green focus roles. Menus and modals use the overlay surface. Toolbars use the primary-card toolbar role. Selected options, navigation items, tabs, table rows, and toggles use the selected surface and brand border.

Primary buttons use the green primary-button roles. Secondary buttons use the gray secondary-button roles. Quiet and ghost buttons are transparent until hover, and danger buttons use the danger role only for destructive actions.

Tables use the table-header role, primary table-row role, alternate-row role, and shared hover role. Neutral badges use the neutral badge surface; product, connected, live, and success badges use the brand badge surface. Informational messages use a gray card with a green icon rather than a separate information color.

Primary text, secondary text, muted text, disabled text, placeholder text, links, and on-brand text each use their named shared role. Borders use subtle, default, strong, or brand roles according to hierarchy; page-local border colors are not allowed.

Position identity stays inside the shared ramps: quarterback, running back, wide receiver, tight end, and flex use distinct green steps; kicker, defense, bench, and reserve use distinct gray steps. Position text or abbreviations remain visible so meaning never depends on color alone.

Draft pages use the draft editorial image, research and tools pages use the research editorial image, and league, history, and This Week pages use the league editorial image. Images support page identity and remain readable beneath the shared dark-to-green overlay. Photography is darkened or desaturated when necessary so a blue cast does not become an interface surface.

Selected, active, warning, and position states must style the whole owning container. Use a complete border, a uniform surface change, or text and icon color.

Compound fields must read as one control. Prefixes, suffixes, and values share one border and one clipped surface; nested inputs stay transparent when the parent owns the field shell.

Editable numeric fields use one shared stepper: a compact green-accented up/down chevron control inset at the right edge of the shared field surface, with separate accessible increment and decrement hit regions.

## No AI slop

This is a binding product rule. Do not use generic AI-looking imagery or templated AI interface treatments anywhere in FFAA. Prohibited treatments include hand-drawn decorative SVG scenes, cartoon or clip-art sports diagrams, fake dashboard mockups, repetitive equal-card grids, generic proof tiles, decorative pills, invented metrics, slogan-heavy filler copy, and decorative highlighted sides or accent rails on cards.

Use purposeful, route-specific editorial photography, approved brand or team artwork, and real product content. Preserve approved imagery unless the user explicitly asks to replace it. If no suitable asset exists, leave a clearly identified asset requirement instead of fabricating placeholder art.

Selection, activity, status, position, and emphasis must never be shown with a highlighted side of a card. Style the full perimeter, full surface, text, or icon instead. Before reconciling concurrent branches or promoting a release, compare visual-asset paths and selected-state CSS with the approved version so stale placeholder art and one-sided accents cannot overwrite it.

## Density and typography

This is an information-dense product, not a poster. Layouts must maximize useful information without crowding controls or reducing ordinary body copy below 16px.

Use the shared density roles in `src/styles/tokens.css`. The landing display is capped by `--type-display-hero` at 4.75rem. Normal page titles are capped by `--type-display-page` at 3.75rem. Section and card titles use their smaller named roles. Do not add a page-local viewport clamp that exceeds those caps.

Page heroes and cards use natural height. Do not add `min-height` merely to make a surface feel substantial, and do not vertically center short content inside a tall empty container. A minimum height is allowed only when it protects an interaction, visualization, media aspect ratio, loading skeleton, or explicitly designed empty state.

Desktop pages should use the available shared content width. At a 900px-tall desktop viewport, the primary hero action and the beginning of the next useful content group should normally be visible without scrolling. Supporting images use an aspect ratio rather than a fixed tall height.

Group by proximity before adding another card. Use the compact spacing roles for card padding and related groups, the section role between separate tasks, and the page role only between page chapters. Repeated cards in one row may match height, but one card must not force unrelated rows or sections to reserve empty space.

On wide landing pages, independent feature chapters may use two equal columns with secondary-card surfaces. Collapse them to one column before image, title, or body-copy measures become cramped, and keep the DOM reading order unchanged.

Repeated editable data belongs in one compact list or table shell. On desktop, use shared column headers, single-line controls, and row dividers; do not turn every record into a padded card or repeat the same visible field labels in every row. At wide desktop widths, pack independent records into two or more columns before letting the editor consume most of the viewport. A common 10-12-record single-line editor should occupy roughly 250-350px vertically, not merely fit inside a 900px-tall viewport. Preserve explicit labels and full-size controls when the layout stacks on mobile.

## Do's and Don'ts

- Do use a full perimeter border when color identifies a position or state.
- Do use the semantic color roles from `src/styles/tokens.css` for every shared surface, control, and text role.
- Do keep green as the primary action and selection color across every page.
- Do use the named text, border, badge, table, overlay, toolbar, and status roles for their matching elements.
- Do map outer and nested cards to the primary-card and secondary-card roles.
- Do keep football-position identity inside the approved green and gray ramps.
- Do keep every field fill, border, and focus treatment clipped to one control shell.
- Do use the shared numeric stepper for every editable number field.
- Do use the named display, page, section, panel, and card density roles.
- Do keep page heroes and ordinary cards at natural height.
- Do verify the first useful follow-up content appears in a 900px-tall desktop viewport.
- Do use one compact list or table shell for repeated editable records on desktop.
- Do preserve approved route imagery through branch reconciliation and release promotion.
- Do communicate clickability through clear labels, hierarchy, borders, underlines, and hover or focus states.
- Do not use blue, cyan, teal, or navy-blue for any interface element.
- Do not sample an official team or editorial-image color into interface chrome.
- Do not create an orange or page-local primary-action color.
- Do not hard-code a new gray or green when an existing ramp step or semantic role fits.
- Do not use decorative left-edge stripes, left-only borders, inset left bars, or left-edge pseudo-elements to indicate selection, activity, status, position, or emphasis.
- Do not replace approved imagery with generic AI-looking, hand-drawn, decorative, or placeholder artwork.
- Do not give a nested input its own fill when the parent already owns the field surface.
- Do not expose browser-native number arrows or omit the shared stepper from an editable number field.
- Do not use oversized viewport-relative headings as the primary source of hierarchy.
- Do not add empty height, padding, or spacer elements to make a page feel more important.
- Do not wrap every repeated data row in its own padded card or repeat identical desktop field labels row after row.
- Do not append decorative right-arrow icons or glyphs to buttons, links, feature rows, navigation links, or calls to action. Directional icons are reserved for controls where direction is the actual meaning; chevrons remain appropriate for disclosure and dropdown state.
