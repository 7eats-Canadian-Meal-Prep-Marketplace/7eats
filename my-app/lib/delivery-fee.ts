export interface DeliveryZoneConfig {
  maxDeliveryKm: number | null;
  deliveryRatePerKm: string | number | null; // stored as numeric in DB, may be string
  deliveryFlatFee: string | number | null;
  freeDeliveryAbove: string | number | null;
}

export interface DeliveryFeeResult {
  fee: number;
  isFree: boolean;
  isOutOfRange: boolean;
  distanceKm: number;
}

export function calcDeliveryFee(
  config: DeliveryZoneConfig,
  distanceKm: number,
  orderSubtotal: number,
): DeliveryFeeResult {
  const maxKm = config.maxDeliveryKm ?? null;
  const ratePerKm = Number(config.deliveryRatePerKm ?? 0);
  const flatFee = Number(config.deliveryFlatFee ?? 0);
  const freeAbove =
    config.freeDeliveryAbove != null ? Number(config.freeDeliveryAbove) : null;

  // Out of range
  if (maxKm !== null && distanceKm > maxKm) {
    return { fee: 0, isFree: false, isOutOfRange: true, distanceKm };
  }

  // Free above threshold
  if (freeAbove !== null && orderSubtotal >= freeAbove) {
    return { fee: 0, isFree: true, isOutOfRange: false, distanceKm };
  }

  const fee = flatFee + ratePerKm * distanceKm;
  return {
    fee: Math.round(fee * 100) / 100,
    isFree: false,
    isOutOfRange: false,
    distanceKm,
  };
}
