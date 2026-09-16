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

### 2. Configure the environment

A downloaded package ships `.env` with generated secrets and default ports; adjust the `DB_*` and `ADMIN_*` values. A package received through the git release channel carries no `.env` (it is listed in `.gitignore`): Copy `.env.example` to `.env` and fill in `DB_PASSWORD` (also inside `DATABASE_URL`), `BETTER_AUTH_SECRET`, and `ADMIN_PASSWORD`. Values containing spaces stay in double quotes (e.g. `ADMIN_NAME="Max Mustermann"`).

Required variables:

| Variable | Description |
|---|---|
| `DB_NAME` | Database to create |
| `DB_USER` | Database user to create; it owns every table |
| `DB_PASSWORD` | Password for the database user |
| `DB_HOST`, `DB_PORT` | Where PostgreSQL listens (default: `localhost`, `5432`) |
| `DATABASE_URL` | `postgres://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME`; keep it in sync with the `DB_*` values |
| `BETTER_AUTH_SECRET` | Random 32-byte hex secret for sign-in tokens (pre-filled) |
| `BETTER_AUTH_URL` | Address users reach the software at: `http://localhost:3500` in development, the public `https://` address in production. Emailed links, payment return addresses, and passkeys are built from it and `CORS_ORIGIN`, never from the address a request claims; the backend refuses to start when either is not a full URL |
| `PORT` | Port the backend listens on (default: `3500`); in production it also serves the frontend |
| `CORS_ORIGIN` | Origin of the development frontend (`http://localhost:4500`); empty in production |
| `VITE_BACKEND_PORT` | Backend port the development frontend calls; must match `PORT` |
| `VITE_FRONTEND_PORT` | Port of the development frontend (default: `4500`) |
| `ADMIN_EMAIL`, `ADMIN_NAME` | The initial administrator account |
| `ADMIN_PASSWORD` | Password of the initial administrator account (pre-filled with a random value); `setup:auth` prints it once and clears it from `.env` |
| `VITE_CURRENCY` | Present when the program declares no currency: the ISO 4217 code every money amount is shown in; rebuild the frontend after a change |

Optional variables:

| Variable | Description |
|---|---|
| `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD`, `DB_ADMIN_DATABASE` | The administrator role and maintenance database `setup:db` connects to (default: `postgres`, no password, `postgres`). Set `DB_ADMIN_PASSWORD` for a remote host, a container, or any install where that role needs a password, and `DB_ADMIN_DATABASE` when the provider has no `postgres` database (e.g. `defaultdb`). Used only by `setup:db` |
| `TRUST_PROXY` | Number of reverse proxies in front of the backend (usually `1`), so sign-in rate limits count per client. Empty when the backend is reached directly |
| `VITE_API_URL` | Only when the built frontend is served from another origin than the backend: the backend's public address. Set it before `npm run build`, and set `CORS_ORIGIN` to the frontend's origin |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Email delivery. Without them verification, password reset and invitation links are printed to the backend log |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. Without them the Google button shows as not configured |
| `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` | Apple sign-in |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft sign-in |

### 3. Create the database

```bash
npm run setup:db
```

Connects to PostgreSQL as an administrator and creates `DB_NAME` and `DB_USER` with `DB_PASSWORD`. It creates no tables. It tries, in order, `DB_ADMIN_USER` over the network with `DB_ADMIN_PASSWORD`, the local socket, and (Linux and macOS) `sudo -u postgres`, and prints what it tried when none connects.

Running it again keeps the database and the user, resets the user's password to `DB_PASSWORD`, and hands tables owned by another role to `DB_USER`. When the download includes data (`database/data.sql`), it also allows `DB_USER` to load it with foreign key checks suspended, which needs a superuser administrator.

### 4. Create the tables

```bash
npm run migrate
```

Connects as `DB_USER` through `DATABASE_URL` and applies every migration in `database/migrations` in one transaction, so `DB_USER` owns every table. On a new database it then loads `database/data.sql` if present.

### 5. Create the administrator account

```bash
npm run setup:auth
```

Creates the account from `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME`, prints the password once, and clears `ADMIN_PASSWORD` in `.env`. Store the password when it is printed. Running it again leaves an existing account's password unchanged. When no account exists for `ADMIN_EMAIL` and `ADMIN_PASSWORD` is empty, it stops and asks for a password.

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

Keep your existing `.env` and delete the one in the new download: Every download ships fresh secrets, and a new `.env` changes the database password and signs every user out. If you do take the new `.env`, run `npm run setup:db` once so the database user's password matches it again.

```bash
npm install
npm run migrate
npm run build
npm start
```

`migrate` applies only migrations not yet recorded in `schema_migrations` and carries your data forward. It first compares the database's tables and column types with the last applied migration and stops on a mismatch, so a database changed by hand is refused rather than migrated into an inconsistent state. If it stops with `must be owner of table`, the database was set up by an earlier package: Run `npm run setup:db` once and `npm run migrate` again.
