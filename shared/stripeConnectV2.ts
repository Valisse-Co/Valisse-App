export const STRIPE_ACCOUNTS_V2_API_VERSION = "2026-08-26.preview";

export function createRecipientAccountRequest(params: {
  techId: number;
  email?: string | null;
  displayName?: string | null;
}) {
  return {
    contact_email: params.email ?? undefined,
    display_name: params.displayName ?? undefined,
    dashboard: "express" as const,
    identity: { country: "US" },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    defaults: {
      currency: "usd",
      responsibilities: {
        fees_collector: "application" as const,
        losses_collector: "application" as const,
      },
    },
    metadata: { valisse_tech_id: String(params.techId) },
    include: ["configuration.recipient", "requirements"] as Array<"configuration.recipient" | "requirements">,
  };
}

export function createRecipientOnboardingLinkRequest(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return {
    account: params.accountId,
    use_case: {
      type: "account_onboarding" as const,
      account_onboarding: {
        configurations: ["recipient"],
        collection_options: { fields: "eventually_due" as const, future_requirements: "include" as const },
        refresh_url: params.refreshUrl,
        return_url: params.returnUrl,
      },
    },
  };
}

export function isRecipientPayoutReady(status: string | null | undefined): boolean {
  return status === "active";
}
