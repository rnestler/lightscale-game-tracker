# Backend

The backend is a workspace of this package. Install, database setup, and configuration run from the package root as the root `README.md` and `SELF-HOSTING.md` describe; the backend reads the root `.env`.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Runs the backend from `src` and restarts it on changes |
| `npm run build` | Compiles `src` to `dist` |
| `npm start` | Runs `dist` on `PORT`, serving the API and the built frontend |
| `npm run setup:auth` | Creates the administrator account (the root `npm run setup:auth` calls it) |
| `npm run check` | Type-checks and lints `src` |

## Scope

Nested collection routes are emitted one level deep. Each verifies the immediate parent-to-child relationship, so a child is never reachable through an unrelated parent. Collections nested more than one level deep are available only on the hosted runtime, not in this exported package.
