/**
 * A recurring schedule day with no saved service IDs is intentionally open to
 * every active service offered by the technician. When IDs are selected, a
 * combined appointment is eligible only when every requested service appears.
 */
export function areServicesAvailableForDay(
  selectedServiceIds: readonly number[],
  requestedServiceIds: readonly number[],
): boolean {
  if (selectedServiceIds.length === 0) return true;
  const selectedIds = new Set(selectedServiceIds);
  return requestedServiceIds.every((serviceId) => selectedIds.has(serviceId));
}

/**
 * Returns any requested selection that is not an active service owned by the
 * technician. The database layer determines that trusted owned-active set.
 */
export function getInvalidServiceSelectionIds(
  requestedServiceIds: readonly number[],
  ownedActiveServiceIds: readonly number[],
): number[] {
  const ownedActiveIds = new Set(ownedActiveServiceIds);
  return Array.from(new Set(requestedServiceIds)).filter((serviceId) => !ownedActiveIds.has(serviceId));
}
