# GameRank Tracker

## First install

```bash
npm install
npm run setup:db
npm run migrate
npm run setup:auth
```

`npm run setup:all` runs the same four steps. `setup:db` creates the database and its user, `migrate` creates the tables as that user, and `setup:auth` creates the administrator account and prints its password once. `SELF-HOSTING.md` explains each step and every `.env` value.

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
