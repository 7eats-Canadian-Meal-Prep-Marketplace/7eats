/** Client-safe dish lifecycle copy — no database imports. */

export type UnavailableOrderDish = {
  dishId: string;
  name: string;
  reason: "paused" | "not_found";
};

export function openOrdersArchiveError(openOrderCount: number): string {
  if (openOrderCount === 1) {
    return "This meal is on 1 open order. Finish or cancel that order before pausing it.";
  }
  return `This meal is on ${openOrderCount} open orders. Finish or cancel them before pausing it.`;
}

export function formatUnavailableDishesMessage(
  unavailable: UnavailableOrderDish[],
): string {
  if (unavailable.length === 1) {
    const item = unavailable[0];
    if (item.reason === "paused") {
      return `${item.name} is no longer available. The cook paused it while you were checking out.`;
    }
    return "A meal in your cart is no longer available. Update your cart to continue.";
  }

  const names = unavailable.map((d) => d.name).join(", ");
  return `${names} are no longer available. The cook paused them while you were checking out. Update your cart to continue.`;
}
