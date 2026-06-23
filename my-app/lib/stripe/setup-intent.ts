/** `seti_xxx_secret_yyy` → `seti_xxx` */
export function setupIntentIdFromClientSecret(clientSecret: string): string {
  const marker = "_secret_";
  const idx = clientSecret.indexOf(marker);
  return idx === -1 ? clientSecret : clientSecret.slice(0, idx);
}
