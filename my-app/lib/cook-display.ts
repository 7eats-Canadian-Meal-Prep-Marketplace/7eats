type CookNameFields = {
  cookName?: string | null;
  displayName?: string | null;
};

export function cookPersonName(cook: CookNameFields): string {
  const person = cook.cookName?.trim();
  if (person) return person;
  return cook.displayName?.trim() || "Chef";
}

export function kitchenDisplayName(
  cook: Pick<CookNameFields, "displayName">,
): string {
  return cook.displayName?.trim() || "Kitchen";
}

export function shouldShowKitchenSubtitle(cook: CookNameFields): boolean {
  const kitchen = cook.displayName?.trim();
  if (!kitchen) return false;
  const person = cook.cookName?.trim();
  if (!person) return true;
  return kitchen.toLowerCase() !== person.toLowerCase();
}
