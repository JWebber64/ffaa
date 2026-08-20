---
version: alpha
name: Fantasy Football presented by GameHQ
description: Interface rules for the fantasy-football application.
---

## Overview

Fantasy Football presented by GameHQ is a dark, information-dense workspace for drafts, league management, history, and research tools. State changes should remain legible through complete container boundaries and restrained surface changes.

## Components

Selected, active, warning, and position states must style the whole owning container. Use a complete border, a uniform surface change, or text and icon color.

Compound fields must read as one control. Prefixes, suffixes, and values share one border and one clipped surface; nested inputs stay transparent when the parent owns the field shell.

## Do's and Don'ts

- Do use a full perimeter border when color identifies a position or state.
- Do keep every field fill, border, and focus treatment clipped to one control shell.
- Do not use decorative left-edge stripes, left-only borders, inset left bars, or left-edge pseudo-elements to indicate selection, activity, status, position, or emphasis.
- Do not give a nested input its own fill when the parent already owns the field surface.
