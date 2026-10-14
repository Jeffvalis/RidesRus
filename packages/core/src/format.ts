/** "3 min", "1 min", "Now" — rounded up so riders are early rather than late. */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 45) return 'Now';
  return `${Math.ceil(seconds / 60)} min`;
}

/** "350 m", "1.4 km" */
export function formatDistance(metres: number): string {
  if (metres < 950) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** "just now", "4m ago", "2h ago" */
export function formatAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 30) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Ada Obi" → "Ada O." — what drivers see; full names stay private. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}
