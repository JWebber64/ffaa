# Archived Supabase Schema

The application runtime moved completely to Firebase. Nothing under this directory is deployed or queried by the app.

These SQL migrations are retained only as a recoverable snapshot of the former multiplayer and League History schemas. The former Supabase database is also retained temporarily as a rollback data source. Do not add `VITE_SUPABASE_*` variables or run these migrations for a current environment.

Current setup and data-import instructions are in the root `README.md` and `docs/FIREBASE_LEAGUE_HISTORY.md`.
