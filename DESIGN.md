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

All editable fields and select triggers use the same dark-teal field surface and border as their inset arrow controls. This applies to text, search, select, textarea, single-chevron, and dual-chevron numeric controls.

Editable numeric fields use one shared stepper: a compact teal up/down chevron control inset at the right edge of the field, with separate accessible increment and decrement hit regions.

## Do's and Don'ts

- Do use a full perimeter border when color identifies a position or state.
- Do keep every field fill, border, and focus treatment clipped to one control shell.
- Do keep single- and dual-chevron arrow boxes at the shared compact size with even inset spacing.
- Do use the shared numeric stepper for every editable number field.
- Do not use decorative left-edge stripes, left-only borders, inset left bars, or left-edge pseudo-elements to indicate selection, activity, status, position, or emphasis.
- Do not give a nested input its own fill when the parent already owns the field surface.
- Do not expose browser-native number arrows or omit the shared stepper from an editable number field.
