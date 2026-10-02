# Experience refresh QA — 2026-10-01 UTC / 2026-10-02 Cairo

## Results

- `npm run verify`: passed (TypeScript, ESLint, production client/server builds).
- Isolated experience/security/UI suite: 84 checks passed.
- Previous admission UX regression suite: 32 checks passed.
- `git diff --check`: passed.
- Fresh isolated database: all migrations, including 0007, applied successfully.
- Existing-schema rehearsal: additive 0007 rerun preserved users and existing academy records.

## Coverage

Authenticated push configuration, honest missing-configuration status, official endpoint allowlist, malicious/private endpoint rejection, subscription upsert, cross-student subscription protection, durable notification outbox, private payload, mocked provider delivery, expired subscription cleanup (410), transient failure retry (503), five-attempt limit, administrator application notification, safe profile summary, real API-backed UI subscription/unsubscription with browser push APIs mocked.

Home, pricing, how-it-works and login were checked in English and Arabic at 320, 375, 390, 768, 1024 and 1440px, with no horizontal overflow. Three distinct pricing focuses, four onboarding steps, password visibility, profile details, mobile profile, dark profile and absence of browser runtime errors passed. Regression checks cover country/phone validation, nine unique enrollment options, header logo presentation and absence of fake language-transition loading.

The commands used were `node --import tsx /workspace/scratch/8aac5df4a464/home-qa/experience-qa.ts` and `node --import tsx /workspace/scratch/8aac5df4a464/home-qa/admission-ux.ts`, executed from the project directory in the isolated QA workspace. These testing fixtures are not installed into the academy or included as production demo data.

Screenshots use isolated test accounts. No screenshots prove real push delivery on an Android or iPhone device. No production Push, Zoom, Google or email service was contacted by the automated tests.

## Remaining deployment checks

Configure the three Web Push variables, apply the additive migration, restart the Node worker and verify on the final HTTPS domain. Test opt-in, closed-dashboard delivery, alert navigation and opt-out on real Android and installed iPhone web apps. Existing Zoom/Google/Resend configuration remains separate.
