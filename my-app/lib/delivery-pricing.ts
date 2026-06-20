/** Per-km delivery rate bounds for cook self-delivery (CAD / km). */
export const DELIVERY_RATE_MIN = 0.5;
export const DELIVERY_RATE_MAX = 2;
export const DELIVERY_RATE_STEP = 0.05;

/** Max delivery distance a cook may offer (km). */
export const DELIVERY_MAX_KM_MIN = 1;
export const DELIVERY_MAX_KM_MAX = 15;

/** Sensible starting zone for home-cook self-delivery (km). */
export const DEFAULT_MAX_DELIVERY_KM = 8;

/** Upper bound for the optional "free delivery above subtotal" threshold (CAD). */
export const FREE_DELIVERY_ABOVE_MAX = 9999.99;

export function clampDeliveryRate(rate: number): number {
  const stepped = Math.round(rate / DELIVERY_RATE_STEP) * DELIVERY_RATE_STEP;
  return Math.min(
    DELIVERY_RATE_MAX,
    Math.max(DELIVERY_RATE_MIN, Math.round(stepped * 100) / 100),
  );
}

export function defaultDeliveryRate(): number {
  return DELIVERY_RATE_MIN;
}

export function defaultMaxDeliveryKm(): number {
  return DEFAULT_MAX_DELIVERY_KM;
}

/** Fill in delivery zone fields when self-delivery is enabled but unset. */
export function withDeliveryDefaults<
  T extends {
    maxDeliveryKm?: number | null;
    deliveryRatePerKm?: number | string | null;
    deliveryFlatFee?: number | string | null;
  },
>(fields: T): T {
  return {
    ...fields,
    maxDeliveryKm: fields.maxDeliveryKm ?? DEFAULT_MAX_DELIVERY_KM,
    deliveryRatePerKm:
      fields.deliveryRatePerKm != null
        ? clampDeliveryRate(Number(fields.deliveryRatePerKm))
        : defaultDeliveryRate(),
    deliveryFlatFee: 0,
  };
}
