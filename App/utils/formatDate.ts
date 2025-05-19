/**
 * Format a timestamp or Date object into a human-readable string.
 * Defaults to short-form like: Jan 2, 2025
 */

export function formatDate(date: string | number | Date): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
