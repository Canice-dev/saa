# Sales Assistant web app

This Next.js app is the dashboard and server endpoint for one business installation. The same source is deployed separately for each business, with a separate Neon database and provider credentials.

## Local setup

1. Copy `.env.example` to `.env` and fill values locally. Never commit `.env` or send credentials in chat.
2. `DATABASE_URL` should be the connection string for this installation's Neon database.
3. `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are used by the server-side WhatsApp adapter. `WHATSAPP_MESSAGING_ACCOUNT_ID` is the WABA ID.
4. `META_APP_SECRET` is used to validate `X-Hub-Signature-256` on webhook POSTs. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` to a private random value and enter the same value in Meta's webhook configuration.
5. Apply Drizzle migrations and seed the single-business defaults with `npm run db:migrate`.
6. Make schema changes in `src/lib/db/schema.ts`, generate a migration with `npm run db:generate`, review the SQL, and apply it with `npm run db:migrate`.
7. `npm run db:migrate:legacy` is only for a database that has not yet received the original `db/migrations` bootstrap. Do not run it after the Drizzle baseline has been applied.
6. Start the app with `npm run dev`.

The Meta callback path is `/api/webhooks/meta`. Meta requires a publicly reachable HTTPS URL; for local development, expose the local app through an HTTPS tunnel and use that URL with the callback path. Subscribe the WhatsApp app to the `messages` webhook field.

The webhook verifies Meta's challenge and request signature, stores incoming messages and delivery-status events idempotently, and writes delayed-reply outbox records in the same database statement. Run `npm run ai:worker` in a separate terminal or persistent worker service to process due replies. The first worker version sends the fixed greeting `Hello Sales Assistant, how can I help today?`; it does not call an AI model. It only claims jobs while `business_settings.automation_enabled` is true, and skips paused or resolved conversations, stale inbound events, and messages that already received a seller reply. Automation remains disabled by default. Verify WhatsApp credentials and the reply flow before enabling it for the business.

`GET /api/health` reports web-process health only; it does not prove that the database or Meta integration is ready.
