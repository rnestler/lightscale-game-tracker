# Self-Hosting Guide

## Prerequisites

- Node.js 20 or later
- PostgreSQL 15 or later (running locally or on a remote host)

## First install

Run every command from the package root. `npm run setup:all` runs steps 1, 3, 4 and 5 in order.

### 1. Install dependencies

```bash
npm install
```

The package is an npm workspace: This one command installs the backend, the frontend, and the development tools such as `concurrently` that `npm run dev` and `npm run check` need, all into `node_modules` at the package root. An `npm install` inside `backend` or `frontend` installs only that half and leaves the tools out.

### 2. Configure the environment

The package ships `.env.example` with default ports and no secrets; no secret of this installation ever leaves your machine. `npm run setup:db` copies `.env.example` to `.env` when there is none and generates `DB_PASSWORD`, `BETTER_AUTH_SECRET`, and `DATABASE_URL` where they are empty; `npm run setup:auth` generates the administrator password when `ADMIN_PASSWORD` is empty. To choose your own `DB_*` or `ADMIN_*` values, copy `.env.example` to `.env` and edit it before step 3; the setup keeps every value you set. `.env` is listed in `.gitignore`. Values containing spaces stay in double quotes (e.g. `ADMIN_NAME="Max Mustermann"`).

Required variables:

| Variable | Description |
|---|---|
| `DB_NAME` | Database to create |
| `DB_USER` | Database user to create; it owns every table |
| `DB_PASSWORD` | Password for the database user; `setup:db` generates it when empty |
| `DB_HOST`, `DB_PORT` | Where PostgreSQL listens (default: `localhost`, `5432`) |
| `DATABASE_URL` | `postgres://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME`; `setup:db` fills it from the `DB_*` values when empty, and a changed `DB_*` value needs it cleared or updated |
| `BETTER_AUTH_SECRET` | Random 32-byte hex secret for sign-in tokens; `setup:db` generates it when empty |
| `BETTER_AUTH_URL` | Address users reach the software at: `http://localhost:3500` in development, the public `https://` address in production. Emailed links, payment return addresses, and passkeys are built from it and `CORS_ORIGIN`, never from the address a request claims; the backend refuses to start when either is not a full URL |
| `PORT` | Port the backend listens on (default: `3500`); in production it also serves the frontend |
| `CORS_ORIGIN` | Origin of the development frontend (`http://localhost:4500`); empty in production |
| `VITE_BACKEND_PORT` | Backend port the development frontend calls; must match `PORT` |
| `VITE_FRONTEND_PORT` | Port of the development frontend (default: `4500`) |
| `ADMIN_EMAIL`, `ADMIN_NAME` | The initial administrator account |
| `ADMIN_PASSWORD` | Password of the initial administrator account; `setup:auth` generates one when empty, prints it once, and clears it from `.env` |
| `VITE_CURRENCY` | Present when the program declares no currency: the ISO 4217 code every money amount is shown in; rebuild the frontend after a change |

Optional variables:

| Variable | Description |
|---|---|
| `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD`, `DB_ADMIN_DATABASE` | The administrator role and maintenance database `setup:db` connects to (default: `postgres`, no password, `postgres`). Set `DB_ADMIN_PASSWORD` for a remote host, a container, or any install where that role needs a password, and `DB_ADMIN_DATABASE` when the provider has no `postgres` database (e.g. `defaultdb`). Used only by `setup:db` |
| `TRUST_PROXY` | Number of reverse proxies in front of the backend (usually `1`), so sign-in rate limits count per client. Empty when the backend is reached directly |
| `VITE_API_URL` | Only when the built frontend is served from another origin than the backend: the backend's public address. Set it before `npm run build`, and set `CORS_ORIGIN` to the frontend's origin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Email delivery. Without them verification, password reset and invitation links are printed to the backend log |
| `SMTP_ALLOW_PLAINTEXT` | Mail goes out only over TLS (implicit TLS on port 465, STARTTLS otherwise) and the send fails when the server offers none. Set `true` only for a local relay without TLS |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. Without them the Google button shows as not configured |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft sign-in |

### 3. Create the database

```bash
npm run setup:db
```

Completes `.env` as step 2 describes, then connects to PostgreSQL as an administrator and creates `DB_NAME` and `DB_USER` with `DB_PASSWORD`. It creates no tables. It tries, in order, `DB_ADMIN_USER` over the network with `DB_ADMIN_PASSWORD`, the local socket, and (Linux and macOS) `sudo -u postgres`, and prints what it tried when none connects.

Running it again keeps the database and the user, resets the user's password to `DB_PASSWORD`, and hands tables owned by another role to `DB_USER`.

### 4. Create the tables

```bash
npm run migrate
```

Connects as `DB_USER` through `DATABASE_URL` and applies every migration in `database/migrations` in one transaction, so `DB_USER` owns every table. On a new database it then loads `database/data.sql` if present; on a database that already holds migrations it skips the file and says so.

### 5. Create the administrator account

```bash
npm run setup:auth
```

Creates the account from `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`, or a generated password when `ADMIN_PASSWORD` is empty, prints the password once, and clears `ADMIN_PASSWORD` in `.env`. Store the password when it is printed. Running it again leaves the administrator's password unchanged. An account for `ADMIN_EMAIL` that is not the administrator stops it: It never takes over an account someone else registered.

### 6. Start

```bash
npm run dev
```

Open `http://localhost:4500` and sign in with `ADMIN_EMAIL` and the password `setup:auth` printed.

## Production

```bash
npm run build
npm start
```

`build` compiles the backend to `backend/dist` and the frontend to `frontend/dist`. `start` runs one Node process on `PORT` that serves the frontend and the API. The production values in `.env`:

```bash
BETTER_AUTH_URL="https://www.example.com"
CORS_ORIGIN=""
TRUST_PROXY=1
```

### Reverse proxy

The proxy terminates TLS and forwards every path to `PORT`; keep `PORT` closed to the outside. With Caddy:

```
www.example.com {
  reverse_proxy localhost:3500
}
```

With nginx:

```nginx
server {
  listen 443 ssl;
  server_name www.example.com;
  ssl_certificate /etc/ssl/www.example.com.pem;
  ssl_certificate_key /etc/ssl/www.example.com.key;
  location / {
    proxy_pass http://127.0.0.1:3500;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Applying an update

Keep your existing `.env`: A download carries none, and a fresh `.env` would change the database password and sign every user out. Compare it with the new `.env.example` and add the entries it does not have yet.

Stop the software and back up the database before you migrate, with `DATABASE_URL` from `.env`:

```bash
pg_dump --format=custom --file=before-update.dump "$DATABASE_URL"
```

Then apply the update:

```bash
npm install
npm run migrate
npm run build
npm start
```

`migrate` applies only migrations not yet recorded in `schema_migrations` and carries your data forward: Values the release computes from existing ones are filled in row by row. It runs in one transaction that locks every table it changes until it commits, so requests wait for it; on large tables that takes minutes, which is why the software stays stopped meanwhile. A second `migrate` started at the same time waits for the first and then finds nothing left to do. A removed or retyped field keeps its values in a hidden `$OLD_` column, shown to administrators as stale data. `npm start` refuses a database that `migrate` has not brought to the release of the software.

### When migrate refuses the database

A refused or failed `migrate` leaves the database exactly as it was.

- Before it changes anything, `migrate` rebuilds the layout of the release the database records in a scratch schema and compares tables, columns, types, defaults, checks, keys and indexes. It lists every difference and stops, so a database changed by hand is never migrated into an inconsistent state. Undo the listed changes, or restore a backup taken before them.
- A database set up by a package from before layout versions were recorded is converted once, as far as the layout allows: Lists stored as text become lists, choice checks are renewed, lists of shared records move into their own tables, and references gain their key columns. What cannot be converted is listed and refused like any other difference.
- A new unique rule stops when existing rows already share a value; the message names the table, the fields, the number of shared values and examples. Make those rows distinct in the running previous release, then run `migrate` again.
- If it stops with `must be owner of table`, the database was set up by an earlier package: Run `npm run setup:db` once and `npm run migrate` again.
- `permission denied for database` means `DB_USER` may not create the scratch schema: Run `npm run setup:db` once, which grants it.

### Restoring the backup

Stop the software, restore the dump over the database, and start the release you ran before:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" before-update.dump
```
