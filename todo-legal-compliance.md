# Valisse — Legal & Compliance Finalization (Launch Readiness)

## Completed Tasks

- [x] Schema: added `supportTickets` table in `drizzle/schema.ts` (category enum, subject, message, appointmentRef, status, userId, name, email)
- [x] Migration: generated `drizzle/0039_cold_gamora.sql` with drizzle-kit, updated `_journal.json`, applied to database
- [x] Server helper: `createSupportTicket` in `server/db.ts`
- [x] tRPC router: `supportRouter.submitTicket` with zod validation (name required, valid email, category enum, subject required, message min 5 chars, optional appointmentRef), formatted ticket numbers (`VAL-0001+`), wired into `server/routers.ts`
- [x] Unit tests: `server/support.test.ts` (3 tests — anonymous submit, authenticated submit with user linkage, validation rejection), all passing
- [x] Privacy Policy: finalized `client/src/pages/PrivacyPolicy.tsx` (14 sections, Nov 8 2026 effective date, Valisse Co LLC, info@valisseco.com, CCPA notice, SMS consent/opt-out, table of contents, print button, cross links)
- [x] Terms of Service: finalized `client/src/pages/TermsOfService.tsx` (20 sections, marketplace disclaimer, subscription pricing, arbitration + class action waiver, Delaware law, limitation of liability, cross links)
- [x] Support page: `client/src/pages/Support.tsx` (hero, direct contact card with mailto, interactive ticket form with category selector, 8-question FAQ accordion, legal quick links, Share button, footer)
- [x] SettingsSupport: `client/src/pages/SettingsSupport.tsx` re-exports unified Support page
- [x] Routing: `/support` added to `PUBLIC_PATHS` and `Router` in `App.tsx`; always accessible without auth/consent gating
- [x] Reusable footer: `client/src/components/AppFooter.tsx` (logo, wordmark, tagline, Discover/Terms/Privacy/Support/Contact links, marketplace disclaimer, copyright) embedded in Discover, TechDashboard, Settings, Login, SignUp
- [x] Discoverability links: "Need help?" card on TechDashboard overview, "Help & Support" row on ClientProfile, support contact note on ConsentStep
- [x] Full verification: TypeScript clean (`pnpm check`), 253 tests passing, production build passing, visual screenshot verification of all pages

## Notes for Future Sessions

- Resend API key is not yet configured (`RESEND_API_KEY`); when added, optional confirmation emails for support tickets can be enabled in `server/routers.ts` (the ticket is already stored in `support_tickets` table)
- Support tickets currently route to the database table; an admin support inbox UI or webhook to Zendesk/HelpScout could be built on top of the same table
