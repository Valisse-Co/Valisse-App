export type SetupIntentConfirmation = {
  id: string;
};

export async function completePaymentMethodSetup(params: {
  confirm: () => Promise<{ error?: { message?: string }; setupIntent?: SetupIntentConfirmation }>;
  save: (setupIntentId: string) => Promise<void>;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = params.timeoutMs ?? 30_000;
  const { error, setupIntent } = await Promise.race([
    params.confirm(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Secure card verification timed out. Please check your connection and try again.")), timeoutMs);
    }),
  ]);
  if (error || !setupIntent) {
    throw new Error(error?.message ?? "We could not save this payment method.");
  }
  await params.save(setupIntent.id);
}
