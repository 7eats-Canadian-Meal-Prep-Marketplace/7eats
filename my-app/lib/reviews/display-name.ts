export function formatReviewerDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = firstName?.trim() ?? "";
  const lastInitial = lastName?.trim()
    ? `${lastName.trim().charAt(0).toUpperCase()}.`
    : "";
  const joined = [first, lastInitial].filter(Boolean).join(" ");
  return joined || "Anonymous";
}
