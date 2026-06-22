import { isRefundEligible } from "@/lib/order-pricing";
import { cancelByDate, formatLeadTime } from "@/lib/refund-policy";

const CANCELLABLE_STATUSES = ["pending", "confirmed"] as const;

export type ClientCancelPolicy = {
  cancellable: boolean;
  refundEligible: boolean;
  /** Last moment (inclusive) a refund is available, if known. */
  refundDeadline: string | null;
  refundDeadlineLabel: string | null;
  summary: string;
  detail: string;
  modalReminder: string;
};

type CancelPolicyInput = {
  status: string;
  cancellationAllowed: boolean;
  pickupAt: Date | string | null;
  fulfillmentWindowStart?: Date | string | null;
  cookLeadTime: string | null;
  fulfillmentMode?: "pickup" | "delivery" | null;
  now?: Date;
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export function formatRefundDeadlineLabel(
  deadline: Date | null,
): string | null {
  if (!deadline) return null;
  return deadline.toLocaleString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Pickup time if set; otherwise the snapshotted fulfillment day. */
export function refundReferenceAt(order: {
  pickupAt: Date | string | null;
  fulfillmentWindowStart?: Date | string | null;
}): Date | null {
  return (
    parseDate(order.pickupAt) ?? parseDate(order.fulfillmentWindowStart ?? null)
  );
}

export function isClientOrderCancellable(order: { status: string }): boolean {
  return CANCELLABLE_STATUSES.includes(
    order.status as (typeof CANCELLABLE_STATUSES)[number],
  );
}

export function isClientRefundEligible(order: CancelPolicyInput): boolean {
  if (!isClientOrderCancellable(order)) return false;
  if (!order.cancellationAllowed) return false;

  const reference = refundReferenceAt(order);
  if (!reference) return true;

  return isRefundEligible(
    reference,
    order.cookLeadTime as Parameters<typeof isRefundEligible>[1],
    true,
    order.now ?? new Date(),
  );
}

export function getClientCancelPolicy(
  order: CancelPolicyInput,
): ClientCancelPolicy {
  const cancellable = isClientOrderCancellable(order);
  const refundEligible = isClientRefundEligible(order);
  const reference = refundReferenceAt(order);
  const referenceIso = reference ? reference.toISOString() : null;
  const deadline = referenceIso
    ? cancelByDate(referenceIso, order.cookLeadTime)
    : null;
  const refundDeadline = toIso(deadline);
  const refundDeadlineLabel = formatRefundDeadlineLabel(deadline);
  const fulfillment =
    order.fulfillmentMode === "delivery" ? "delivery" : "pickup";

  if (!cancellable) {
    return {
      cancellable: false,
      refundEligible: false,
      refundDeadline: null,
      refundDeadlineLabel: null,
      summary: "",
      detail: "",
      modalReminder: "",
    };
  }

  if (!order.cancellationAllowed) {
    return {
      cancellable: true,
      refundEligible: false,
      refundDeadline: null,
      refundDeadlineLabel: null,
      summary:
        "You can cancel before your order is marked ready, but this cook does not offer refunds.",
      detail: "",
      modalReminder: "You will not receive a refund.",
    };
  }

  if (refundEligible) {
    const leadLabel = formatLeadTime(order.cookLeadTime);
    return {
      cancellable: true,
      refundEligible: true,
      refundDeadline,
      refundDeadlineLabel,
      summary: refundDeadlineLabel
        ? `You'll receive a full refund. Refund window closes ${refundDeadlineLabel}.`
        : leadLabel
          ? `You'll receive a full refund. This cook requires ${leadLabel} notice before your scheduled ${fulfillment}.`
          : "You'll receive a full refund.",
      detail: "",
      modalReminder: "This cannot be undone.",
    };
  }

  if (deadline && refundDeadlineLabel) {
    return {
      cancellable: true,
      refundEligible: false,
      refundDeadline,
      refundDeadlineLabel,
      summary: `No refund. The refund window closed ${refundDeadlineLabel}.`,
      detail: "",
      modalReminder: "Your payment will not be returned.",
    };
  }

  const leadLabel = formatLeadTime(order.cookLeadTime);
  return {
    cancellable: true,
    refundEligible: false,
    refundDeadline: null,
    refundDeadlineLabel: null,
    summary: leadLabel
      ? `No refund. You're inside this cook's ${leadLabel} lead time before your scheduled ${fulfillment}.`
      : "No refund is available for this cancellation.",
    detail: "",
    modalReminder: "Your payment will not be returned.",
  };
}
