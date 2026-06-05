import type { MockListingDeal } from "../../_mock";

/** Human-readable redemption limits for the listing deal card. */
export function getDealConditions(deal: MockListingDeal): string[] {
  const lines: string[] = [];

  if (deal.validUntil) {
    const end = new Date(deal.validUntil);
    if (!Number.isNaN(end.getTime())) {
      lines.push(
        `Ends ${end.toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        })}`,
      );
    }
  }

  if (deal.maxUses != null && deal.maxUses > 0) {
    const used = Math.max(0, deal.usesCount ?? 0);
    const left = Math.max(0, deal.maxUses - used);
    lines.push(left === 1 ? "1 redemption left" : `${left} redemptions left`);
  }

  return lines;
}
