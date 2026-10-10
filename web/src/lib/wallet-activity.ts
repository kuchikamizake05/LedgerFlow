export function groupWalletActivity<T extends { createdAt: string }>(entries: T[], now = new Date()): { key: string; label: string; entries: T[] }[] {
  const dates = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const labels = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium" });
  const today = dates.format(now);
  const yesterday = dates.format(new Date(now.getTime() - 86_400_000));
  const groups = new Map<string, { key: string; label: string; entries: T[] }>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? dates.format(date) : "unknown";
    const label = key === today ? "Today" : key === yesterday ? "Yesterday" : valid ? labels.format(date) : "Date unavailable";
    if (!groups.has(key)) groups.set(key, { key, label, entries: [] });
    groups.get(key)!.entries.push(entry);
  }
  return [...groups.values()];
}
