# FollowUp deployment

FollowUp can run as one Node.js application. The Express server serves both the API and the built React frontend in production.

## Build and start

```bash
npm install
npm run build
npm run migrate
npm start
```

Set `NODE_ENV=production` in the hosting environment.

## Required server environment variables

```
DATABASE_URL=
JWT_SECRET=
PORT=
APP_ORIGIN=
SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=FollowUp <you@example.com>
```

For a same-domain deployment, the frontend does not need `VITE_API_URL`; it calls `/api` on the same origin.

## Database

`npm run migrate` applies all SQL files in `server/sql` in filename order:

1. `001_init.sql` — users, follow-ups, activity history.
2. `002_reminders.sql` — reminder preferences and delivery history.

Run migrations before starting the first live instance and again after future releases that add migrations.

## First live validation

1. Open `/api/health` and confirm `{"status":"ok"}`.
2. Register a pilot account.
3. Add a follow-up due within the configured reminder window.
4. Open Reminder preferences and send a test email.
5. Confirm the test email arrives.
6. Confirm the due reminder sends only once.
7. Complete the follow-up and verify it moves to Completed.
8. Create a next follow-up from the completion prompt.

## Privacy

Do not use FollowUp to store account numbers, balances, passwords, identity documents, transaction details, card information, or other confidential banking data.
