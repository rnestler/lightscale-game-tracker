# GameRank Tracker

## First install

```bash
npm install
npm run setup:db
npm run migrate
npm run setup:auth
```

Run every command from the package root: `npm install` there installs the backend, the frontend, and the development tools such as `concurrently` that `npm run dev` needs. An `npm install` inside `backend` or `frontend` installs only that half and leaves the tools out. `npm run setup:all` runs the same four steps. `setup:db` writes `.env` from `.env.example` with secrets generated on this machine and creates the database and its user, `migrate` creates the tables as that user, and `setup:auth` creates the administrator account and prints its password once. `SELF-HOSTING.md` explains each step and every `.env` value.

## Development

```bash
npm run dev
```

Open `http://localhost:4500`. `npm run dev:backend` and `npm run dev:frontend` start the two halves separately.

## Production

```bash
npm run build
npm start
```

One Node process on `PORT` serves the frontend and the API. `SELF-HOSTING.md` describes the reverse proxy and the production `.env` values.

## Updates

Stop the software and back up the database as `SELF-HOSTING.md` describes under Applying an update, then:

```bash
npm install
npm run migrate
npm run build
```

Then restart `npm start`.

## Email and social login

Both are optional. Without `SMTP_*` in `.env` the software still works and prints verification, password reset and invitation links to the backend log. Without OAuth credentials the corresponding sign-in buttons show as not configured.

## Quality checks

```bash
npm run check
```
