/**
 * The table header renders the actions column only for mutators, so the
 * empty filler cells under an assignment row — and the Load More
 * colSpan — must match that column count exactly. The formula lives
 * here so the rows components and the history panel can never drift.
 */
export function assignmentColumnCount(canMutate: boolean): number {
  return canMutate ? 7 : 6
}
