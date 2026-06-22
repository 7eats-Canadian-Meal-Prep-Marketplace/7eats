import { describe, expect, it } from "vitest";
import {
  clientNotificationPrefsEqual,
  DEFAULT_CLIENT_NOTIFICATION_PREFS,
  normalizeClientNotificationPrefs,
} from "@/lib/client-notification-preferences";

describe("normalizeClientNotificationPrefs", () => {
  it("defaults order_updates and marketing to true", () => {
    expect(normalizeClientNotificationPrefs(null)).toEqual(
      DEFAULT_CLIENT_NOTIFICATION_PREFS,
    );
    expect(DEFAULT_CLIENT_NOTIFICATION_PREFS.notifs.order_updates).toBe(true);
    expect(DEFAULT_CLIENT_NOTIFICATION_PREFS.notifs.marketing).toBe(true);
  });

  it("drops legacy notification keys", () => {
    const normalized = normalizeClientNotificationPrefs({
      notifs: {
        new_listing: false,
        order_updates: false,
        messages: true,
        marketing: true,
      },
      channels: { sms: false, email: true },
    });

    expect(normalized).toEqual({
      notifs: { order_updates: false, marketing: true },
      channels: { sms: false, email: true },
    });
    expect(normalized.notifs).not.toHaveProperty("new_listing");
    expect(normalized.notifs).not.toHaveProperty("messages");
  });

  it("compares prefs for dirty-state checks", () => {
    const a = DEFAULT_CLIENT_NOTIFICATION_PREFS;
    const b = normalizeClientNotificationPrefs({
      notifs: { order_updates: false, marketing: true },
      channels: { sms: true, email: true },
    });
    expect(clientNotificationPrefsEqual(a, a)).toBe(true);
    expect(clientNotificationPrefsEqual(a, b)).toBe(false);
  });
});
