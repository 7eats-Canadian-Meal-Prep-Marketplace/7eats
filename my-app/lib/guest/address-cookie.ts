export const GUEST_ADDRESS_COOKIE = "7eats-guest-address";

export function hasGuestAddressCookie(value: string | undefined): boolean {
  return value === "1";
}
