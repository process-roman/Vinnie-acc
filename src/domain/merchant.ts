/**
 * A stable key for a merchant name, so "STARBUCKS #1234" and "Starbucks" match.
 * Returns '' when nothing meaningful is left.
 */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/#\s*\d+/g, ' ') // store numbers
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
