/** Client notification prefs stored in `user.notification_preferences`. */
export type ClientNotificationPrefs = {
  notifs: {
    /** Order status, pickup reminders, etc. */
    order_updates: boolean;
    /** Tips, product updates, newsletters — queryable for marketing sends. */
    marketing: boolean;
  };
  channels: {
    sms: boolean;
    email: boolean;
  };
};

export const DEFAULT_CLIENT_NOTIFICATION_PREFS: ClientNotificationPrefs = {
  notifs: {
    order_updates: true,
    marketing: true,
  },
  channels: { sms: true, email: true },
};

/** Coerce stored JSON (including legacy keys) into the canonical shape. */
export function normalizeClientNotificationPrefs(
  raw: unknown,
): ClientNotificationPrefs {
  const base = DEFAULT_CLIENT_NOTIFICATION_PREFS;
  if (!raw || typeof raw !== "object") {
    return {
      notifs: { ...base.notifs },
      channels: { ...base.channels },
    };
  }

  const record = raw as {
    notifs?: Record<string, unknown>;
    channels?: Record<string, unknown>;
  };

  return {
    notifs: {
      order_updates:
        typeof record.notifs?.order_updates === "boolean"
          ? record.notifs.order_updates
          : base.notifs.order_updates,
      marketing:
        typeof record.notifs?.marketing === "boolean"
          ? record.notifs.marketing
          : base.notifs.marketing,
    },
    channels: {
      sms:
        typeof record.channels?.sms === "boolean"
          ? record.channels.sms
          : base.channels.sms,
      email:
        typeof record.channels?.email === "boolean"
          ? record.channels.email
          : base.channels.email,
    },
  };
}

export function clientNotificationPrefsEqual(
  a: ClientNotificationPrefs,
  b: ClientNotificationPrefs,
): boolean {
  return (
    a.notifs.order_updates === b.notifs.order_updates &&
    a.notifs.marketing === b.notifs.marketing &&
    a.channels.sms === b.channels.sms &&
    a.channels.email === b.channels.email
  );
}
