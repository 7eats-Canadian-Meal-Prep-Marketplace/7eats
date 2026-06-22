function initialsFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0]?.trim();
    if (!local) return null;
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    return local[0]?.toUpperCase() ?? null;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return trimmed[0]?.toUpperCase() ?? null;
}

/** Two-letter avatar initials from profile names, with optional fallbacks. */
export function profileInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  ...fallbacks: (string | null | undefined)[]
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first) {
    return first.length >= 2
      ? first.slice(0, 2).toUpperCase()
      : first[0].toUpperCase();
  }
  if (last) {
    return last.length >= 2
      ? last.slice(0, 2).toUpperCase()
      : last[0].toUpperCase();
  }

  for (const raw of fallbacks) {
    const initials = raw ? initialsFromLabel(raw) : null;
    if (initials) return initials;
  }

  return "?";
}

export function profileDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  ...fallbacks: (string | null | undefined)[]
): string {
  const joined = [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (joined) return joined;

  for (const raw of fallbacks) {
    const fallback = raw?.trim();
    if (fallback) return fallback;
  }

  return "Your Account";
}
