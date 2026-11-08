# Valisse email verification and password recovery

Valisse uses Resend for account-verification, password-reset, and password-change notification emails. These are account-security messages and do not depend on Telnyx or SMS consent.

## Configure the verified sender

Create a Resend account and add a domain you control under Domains. A dedicated subdomain such as `mail.valisseco.com` isolates authentication-email reputation from other mail. Add the exact DNS records Resend supplies and wait for Verified status. Do not replace existing business-inbox MX records just to enable sending. Disable open and click tracking for authentication emails. Resend supports sending from any address under its verified domain; sender verification does not create a receiving mailbox. [1]

Store `RESEND_API_KEY` securely as a server-only environment variable. Use a sending-access key restricted to the verified sending domain. Store `RESEND_FROM_EMAIL` as the matching sender, for example `Valisse <security@mail.valisseco.com>`. Do not use the shared `resend.dev` test sender for customer launches. Never put API keys in source code, client variables, or chat.

Security links use Valisse’s configured `VALISSE_PUBLIC_APP_URL`, defaulting to `https://www.valisseco.com`. They never use an arbitrary browser-provided return URL. Verification links last 24 hours; password-reset links last 30 minutes. Tokens are random, stored as hashes, and submitted only after a person explicitly confirms in the page. Sending uses Resend’s `POST /emails` with an idempotency key. [2]

## Manual checks before publishing

Create an authorized test email/password account. It should reach Verify email, not onboarding. Trying an authenticated onboarding or booking API before verification must fail. Open the email link, verify once, then complete setup. Retry the same link and an expired or superseded link; they must fail without changing identity.

Use Forgot password for an authorized email/password account. Submit matching new passwords through the emailed link and sign in again. The old password and previous sessions must stop working. A reused, expired, or altered reset token must fail. Requesting reset for an unknown email or Google-only account must show the same generic confirmation without creating a password or account.

Test the email link on a different browser with no session. Verification should succeed but must not sign into an account automatically. A link opened while signed into a different account must fail safely. Check the inbox and spam folder, and inspect Resend delivery status; API acceptance alone does not prove inbox delivery.

Existing accounts remain accessible without re-onboarding. They can opt to verify their email from Account settings. New email and Google accounts must verify before onboarding. Google-only users keep using Google to sign in.

## References

[1]: https://resend.com/docs/dashboard/domains/introduction "Resend verified sending domains"
[2]: https://resend.com/docs/api-reference/emails/send-email "Resend Send Email API"
