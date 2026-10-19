# Academy experience refresh and phone notifications

Only admin/student roles are supported. This is an additive update. No accounts, courses, prices, or lessons are deleted.

## Install and migrate

1. Back up the existing database using the deployment guide.
2. Run `npm ci`.
3. For an existing Phase 5 database, run `npm run db:migrate:push`. For production, explicitly set `CONFIRM_PUSH_MIGRATION=yes` after the backup and SQL review. The command is transactional and checksums the migration; repeated execution does not recreate tables or triggers.
4. For a fresh database, use the existing `npm run db:migrate:fresh`; migration 0007 is registered in the journal. Do not run both upgrade paths blindly.
5. Run `npm run verify`.
6. Restart the Node process after setting the variables below. Web Push needs a continuously running worker and a database; static hosting alone will not deliver it.

## Required optional Web Push configuration

- `WEB_PUSH_PUBLIC_KEY`: the public VAPID key.
- `WEB_PUSH_PRIVATE_KEY`: the private VAPID key; server secret only.
- `WEB_PUSH_SUBJECT`: contact URI, for example `mailto:info@salsabela.com`.

Generate a VAPID key pair once with `npx web-push generate-vapid-keys`. Copy directly into the host's environment variable manager. Never commit the output or paste the private key into frontend code. Keep the same keys during redeploys; rotation requires devices to unsubscribe and subscribe again. No paid messaging provider or Firebase project is required.

## User experience

Open dashboard > Profile > Updates on your phone. Press Enable on this device and approve the browser permission. The prompt only appears after the user's action. Enable separately on each device. Disable removes only the current authenticated user's device subscription. The browser subscription itself is reused only after explicit opt-in when changing accounts.

HTTPS is required on the final domain. Localhost is available for isolated development. On iOS/iPadOS 16.4+, add the academy to the Home Screen and open it from there before enabling push. Push availability and delivery depend on browser support, network and operating-system permissions; no real-phone delivery has been claimed without a device test.

Keep dashboard and its API on the same configured origin. A subscription made on `salsabela.com` is distinct from one made on `dashboard.salsabela.com`. If moving origins, subscribe again on the destination. The notification worker opens that same origin's login route, which redirects an authenticated user into their role's dashboard.

## Real events and privacy

Existing message, lesson and progress notifications feed the durable delivery outbox. New assessment applications and contact messages now notify active admins. Only subscriptions owned by the notification recipient receive delivery, and suspended accounts are skipped. Public notification text is intentionally generic; lesson details, message bodies, student names, host URLs and secrets do not appear on the lock screen. Full details remain in the authenticated dashboard.

The worker leases jobs atomically, retries with backoff up to five attempts, and removes expired subscriptions on 404/410. Notification/device pairs are unique. Tags replace an already visible notification if delivery is repeated after an ambiguous network result; network delivery is at-least-once, not a guarantee of exactly one OS alert. Updates older than 24 hours are skipped. Existing unread site notifications remain available. New registrations do not receive old notification history as a burst of push alerts.

No remote fetch occurs for unapproved push hosts; subscription URLs are restricted to official HTTPS push-service domains. Errors log provider status codes, without endpoints, keys or message content.

## Page and copy changes

Home: outcome-led copy, existing three featured courses preserved.
Navigation: How it works appears in both header and footer.
How it works: four real steps from application to invitation and Zoom lesson, with working assessment/sign-in links.
Pricing: original $9/$11/$13 hourly prices preserved. Distinct learning focuses explain foundation, skill development and focused goals. They do not introduce automatic billing, quotas, certificates, fabricated popularity or unimplemented support entitlements. Plan details remain confirmed by the instructor before enrollment.
Login: organized sign-in and new-student panels, password visibility, real existing authentication and Turnstile retained.
Profile: real status, email verification, membership date, last login, photo controls, timezone selection, personal details, password access and opt-in phone notifications. Password hashes and private notes are never returned in the account summary.

## Acceptance checks

Automated tests use an isolated PostgreSQL-compatible database and mocked push transport. No production Zoom/Google/Push accounts are contacted. See the accompanying QA report for commands and results.

Before production acceptance: open the deployed HTTPS site on Android and on an installed iPhone web app; opt in; send a real message/create a real lesson; confirm delivery while the dashboard is closed; open the alert; then disable and confirm further alerts stop. Test the final domain, not only the Replit preview origin.
