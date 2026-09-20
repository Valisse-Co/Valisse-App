export function formatUsdCents(amountInCents: number | null | undefined): string {
  const normalized = Number.isFinite(amountInCents) ? Math.round(Number(amountInCents)) : 0;
  return `$${(normalized / 100).toFixed(2)}`;
}

export function formatUsdDollars(amountInDollars: number | null | undefined): string {
  const normalized = Number.isFinite(amountInDollars) ? Number(amountInDollars) : 0;
  return `$${normalized.toFixed(2)}`;
}

/** Keeps monetary form fields consistent with the amounts shown elsewhere. */
export function formatDollarsInputFromCents(amountInCents: number | null | undefined): string {
  const normalized = Number.isFinite(amountInCents) ? Math.round(Number(amountInCents)) : 0;
  return (normalized / 100).toFixed(2);
}
