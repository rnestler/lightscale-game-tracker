# PostgreSQL Setup

Run these from the package root, in this order. `SELF-HOSTING.md` explains each step and every `.env` value.

1. `npm run setup:db` connects as a PostgreSQL administrator and creates the database `DB_NAME` and the user `DB_USER` with the password `DB_PASSWORD`. It creates no tables. `setup.mjs` runs `setup.sh` on Linux and macOS and `setup.ps1` on Windows; both apply `setup.sql`.
2. `npm run migrate` connects as `DB_USER` through `DATABASE_URL` and applies every migration in `migrations/` in one transaction, so `DB_USER` owns every table. On a new database it then loads `data.sql` if the download includes data. Every run also applies `platform-upkeep.sql`.
3. `npm run setup:auth` creates the administrator account.

`setup:db` and `migrate` are re-runnable. `setup:db` keeps an existing database and user, resets the user's password to `DB_PASSWORD`, and hands existing tables to `DB_USER`. `migrate` records applied migrations in `schema_migrations` and applies only new ones.
