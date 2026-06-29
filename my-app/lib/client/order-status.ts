/** Client-facing order status copy — mirrors cook dashboard: pending → confirmed → ready → fulfilled. */

export type ClientOrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "fulfilled"
  | "cancelled";

type FulfillmentMode = "pickup" | "delivery" | null | undefined;

function isDelivery(mode: FulfillmentMode): boolean {
  return mode === "delivery";
}

/** Short badge label on order list cards. */
export function clientOrderStatusLabel(
  status: ClientOrderStatus,
  fulfillmentMode: FulfillmentMode,
): string {
  switch (status) {
    case "pending":
      return "Waiting for acceptance";
    case "confirmed":
      return "Preparing your order";
    case "ready":
      return isDelivery(fulfillmentMode)
        ? "Ready for delivery"
        : "Ready for pickup";
    case "fulfilled":
      return isDelivery(fulfillmentMode) ? "Delivered" : "Picked up";
    case "cancelled":
      return "Cancelled";
  }
}

/** Vertical tracker on order detail — one step per cook action, no duplicates. */
export function clientOrderTrackerSteps(
  status: ClientOrderStatus,
  fulfillmentMode: FulfillmentMode,
): { label: string; done: boolean }[] {
  const delivery = isDelivery(fulfillmentMode);
  const accepted = ["confirmed", "ready", "fulfilled"].includes(status);
  const ready = ["ready", "fulfilled"].includes(status);
  const complete = status === "fulfilled";

  return [
    { label: "Order placed", done: true },
    { label: "Order accepted", done: accepted },
    {
      label: delivery ? "Ready for delivery" : "Ready for pickup",
      done: ready,
    },
    {
      label: delivery ? "Delivered" : "Picked up",
      done: complete,
    },
  ];
}
