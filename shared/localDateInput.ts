/** Format a date for a native date input using the browser's local calendar day. */
export function toLocalDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Return a local-calendar range for a date input, preserving same-evening dates. */
export function getLocalDateInputRange(daysAhead: number, from: Date = new Date()) {
  const end = new Date(from);
  end.setDate(end.getDate() + daysAhead);
  return {
    min: toLocalDateInputValue(from),
    max: toLocalDateInputValue(end),
  };
}
