/** Ontario HST — placeholder until province is resolved from address/profile. */
export const ONTARIO_HST_RATE = 0.13;

export const ONTARIO_HST_LABEL = "HST (13%)";

export function calcOntarioHst(subtotal: number): number {
  return Math.round(subtotal * ONTARIO_HST_RATE * 100) / 100;
}

export function formatCartMoney(amount: number): string {
  return amount.toFixed(2);
}
