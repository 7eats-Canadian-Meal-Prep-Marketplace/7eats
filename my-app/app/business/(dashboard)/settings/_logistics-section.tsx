"use client";

import { useEffect, useState } from "react";
import LeadTimeCutoffField from "@/app/components/LeadTimeCutoffField";
import { AddressSearchInput } from "@/components/AddressSearchInput";
import { normalizeProvinceCode } from "@/lib/address";
import {
  formatAddressQuery,
  validateLogisticsSettings,
} from "@/lib/business-settings-validation";
import {
  clampDeliveryRate,
  DELIVERY_MAX_KM_MAX,
  DELIVERY_MAX_KM_MIN,
  DELIVERY_RATE_MAX,
  DELIVERY_RATE_MIN,
  DELIVERY_RATE_STEP,
  defaultDeliveryRate,
  defaultMaxDeliveryKm,
  withDeliveryDefaults,
} from "@/lib/delivery-pricing";
import { useDirtyState } from "@/lib/forms/use-dirty";
import {
  DEFAULT_LEAD_TIME_CUTOFF,
  formatDbLeadTimeCutoff,
} from "@/lib/lead-time";
import { isPriceKeystroke } from "@/lib/price";
import { CardFormSkeleton } from "./_skeletons";
import styles from "./page.module.css";

type FulfillmentType = "pickup" | "delivery" | "both";

const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string }[] = [
  { value: "pickup", label: "Pickup only" },
  { value: "delivery", label: "Delivery only" },
  { value: "both", label: "Pickup & delivery" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY_FULL: Record<(typeof DAYS)[number], string> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

const DAY_SHORT: Record<string, (typeof DAYS)[number]> = Object.fromEntries(
  Object.entries(DAY_FULL).map(([short, full]) => [full, short]),
) as Record<string, (typeof DAYS)[number]>;

const LEAD_TIME_OPTIONS = [
  { value: "same_day", label: "Same day" },
  { value: "1_day", label: "1 day before" },
  { value: "2_days", label: "2 days before" },
  { value: "3_days", label: "3 days before" },
  { value: "4_days", label: "4 days before" },
  { value: "5_days", label: "5 days before" },
] as const;

type DayWindow = { from: string; to: string };

type LogisticsForm = {
  pickupStreet: string;
  pickupUnit: string;
  pickupCity: string;
  pickupProvince: string;
  pickupPostal: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupPlaceId: string | null;
  fulfillment: FulfillmentType;
  pickupDays: (typeof DAYS)[number][];
  pickupWindows: Record<string, DayWindow>;
  deliveryDays: (typeof DAYS)[number][];
  deliveryWindows: Record<string, DayWindow>;
  leadTime: string;
  leadTimeCutoff: string;
  maxDeliveryKm: number | null;
  deliveryRatePerKm: number;
  freeDeliveryAbove: string;
};

function deriveFulfillment(
  offersPickup: boolean,
  delivery: string | null,
): FulfillmentType {
  const offersDelivery = delivery === "self";
  if (offersPickup && offersDelivery) return "both";
  if (offersDelivery) return "delivery";
  return "pickup";
}

function windowsToForm(
  rows: Array<{ day: string; from: string; to: string }>,
): {
  days: (typeof DAYS)[number][];
  windows: Record<string, DayWindow>;
} {
  const days: (typeof DAYS)[number][] = [];
  const windows: Record<string, DayWindow> = {};
  for (const row of rows) {
    const short = DAY_SHORT[row.day];
    if (!short) continue;
    days.push(short);
    windows[row.day] = { from: row.from, to: row.to };
  }
  return { days, windows };
}

function windowsFromForm(
  days: (typeof DAYS)[number][],
  windows: Record<string, DayWindow>,
) {
  return days.map((d) => {
    const day = DAY_FULL[d];
    const win = windows[day] ?? { from: "11:00", to: "14:00" };
    return { day, from: win.from, to: win.to };
  });
}

export function LogisticsSection() {
  const {
    value: form,
    setValue: setForm,
    load,
    markClean,
    dirty,
  } = useDirtyState<LogisticsForm>({
    pickupStreet: "",
    pickupUnit: "",
    pickupCity: "",
    pickupProvince: "",
    pickupPostal: "",
    pickupLat: null,
    pickupLng: null,
    pickupPlaceId: null,
    fulfillment: "pickup",
    pickupDays: [],
    pickupWindows: {},
    deliveryDays: [],
    deliveryWindows: {},
    leadTime: "",
    leadTimeCutoff: DEFAULT_LEAD_TIME_CUTOFF,
    maxDeliveryKm: null,
    deliveryRatePerKm: defaultDeliveryRate(),
    freeDeliveryAbove: "",
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/business/dashboard/availability").then((r) => r.json()),
      fetch("/api/business/profile").then((r) => r.json()),
    ])
      .then(([availJson, profileJson]) => {
        const avail = availJson.success ? availJson.data : null;
        const profile = profileJson.success ? profileJson.data : null;
        const pickup = windowsToForm(avail?.pickupWindows ?? []);
        const delivery = windowsToForm(avail?.deliveryWindows ?? []);
        const fulfillment = deriveFulfillment(
          avail?.offersPickup !== false,
          avail?.delivery ?? "none",
        );
        const offersDelivery = fulfillment !== "pickup";
        const deliveryZone = offersDelivery
          ? withDeliveryDefaults({
              maxDeliveryKm:
                profile?.maxDeliveryKm != null
                  ? Number(profile.maxDeliveryKm)
                  : null,
              deliveryRatePerKm: profile?.deliveryRatePerKm,
            })
          : null;

        load({
          pickupStreet: profile?.pickupStreet ?? "",
          pickupUnit: profile?.pickupUnit ?? "",
          pickupCity: profile?.pickupCity ?? "",
          pickupProvince: normalizeProvinceCode(profile?.pickupProvince ?? ""),
          pickupPostal: profile?.pickupPostal ?? "",
          pickupLat: profile?.pickupLat ?? null,
          pickupLng: profile?.pickupLng ?? null,
          pickupPlaceId: profile?.pickupPlaceId ?? null,
          fulfillment,
          pickupDays: pickup.days,
          pickupWindows: pickup.windows,
          deliveryDays: delivery.days,
          deliveryWindows: delivery.windows,
          leadTime: avail?.leadTime ?? profile?.leadTime ?? "",
          leadTimeCutoff: formatDbLeadTimeCutoff(
            avail?.leadTimeCutoff ?? profile?.leadTimeCutoff,
          ),
          maxDeliveryKm: deliveryZone?.maxDeliveryKm ?? null,
          deliveryRatePerKm:
            deliveryZone != null
              ? Number(deliveryZone.deliveryRatePerKm)
              : defaultDeliveryRate(),
          freeDeliveryAbove:
            profile?.freeDeliveryAbove != null
              ? String(profile.freeDeliveryAbove)
              : "",
        });
      })
      .finally(() => setLoading(false));
  }, [load]);

  const offersPickup = form.fulfillment !== "delivery";
  const offersDelivery = form.fulfillment !== "pickup";

  function toggleDay(kind: "pickup" | "delivery", d: (typeof DAYS)[number]) {
    const fullName = DAY_FULL[d];
    setForm((f) => {
      const days = kind === "pickup" ? f.pickupDays : f.deliveryDays;
      const windows = kind === "pickup" ? f.pickupWindows : f.deliveryWindows;
      const isSelected = days.includes(d);
      const newDays = isSelected ? days.filter((x) => x !== d) : [...days, d];
      const newWindows = { ...windows };
      if (isSelected) {
        delete newWindows[fullName];
      } else {
        newWindows[fullName] = { from: "11:00", to: "14:00" };
      }
      return kind === "pickup"
        ? { ...f, pickupDays: newDays, pickupWindows: newWindows }
        : { ...f, deliveryDays: newDays, deliveryWindows: newWindows };
    });
  }

  function setDayWindow(
    kind: "pickup" | "delivery",
    d: (typeof DAYS)[number],
    field: "from" | "to",
    value: string,
  ) {
    const fullName = DAY_FULL[d];
    setForm((f) => {
      const windows = kind === "pickup" ? f.pickupWindows : f.deliveryWindows;
      const updated = {
        ...windows,
        [fullName]: {
          ...(windows[fullName] ?? { from: "11:00", to: "14:00" }),
          [field]: value,
        },
      };
      return kind === "pickup"
        ? { ...f, pickupWindows: updated }
        : { ...f, deliveryWindows: updated };
    });
  }

  async function handleSave() {
    setSaveError(null);

    const offersPickup = form.fulfillment !== "delivery";
    const offersDelivery = form.fulfillment !== "pickup";
    const deliveryZone = offersDelivery
      ? withDeliveryDefaults({
          maxDeliveryKm: form.maxDeliveryKm,
          deliveryRatePerKm: form.deliveryRatePerKm,
        })
      : null;

    const validationError = validateLogisticsSettings({
      ...form,
      maxDeliveryKm: deliveryZone?.maxDeliveryKm ?? null,
      deliveryRatePerKm:
        deliveryZone != null
          ? Number(deliveryZone.deliveryRatePerKm)
          : form.deliveryRatePerKm,
      dayKey: (d) => DAY_FULL[d as (typeof DAYS)[number]] ?? d.toLowerCase(),
    });
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const delivery = offersDelivery ? ("self" as const) : ("none" as const);

    const availRes = await fetch("/api/business/dashboard/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offersPickup: offersPickup,
        delivery,
        leadTime: form.leadTime || undefined,
        leadTimeCutoff: form.leadTimeCutoff || undefined,
        pickupWindows: offersPickup
          ? windowsFromForm(form.pickupDays, form.pickupWindows)
          : [],
        deliveryWindows: offersDelivery
          ? windowsFromForm(form.deliveryDays, form.deliveryWindows)
          : [],
      }),
    });
    const availJson = await availRes.json().catch(() => ({}));
    if (!availRes.ok) {
      setSaveError(availJson.error ?? "Could not save schedule.");
      return;
    }

    const profileRes = await fetch("/api/business/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupStreet: form.pickupStreet || undefined,
        pickupUnit: form.pickupUnit || null,
        pickupCity: form.pickupCity || undefined,
        pickupProvince: normalizeProvinceCode(form.pickupProvince) || undefined,
        pickupPostal: form.pickupPostal || undefined,
        pickupLat: form.pickupLat ?? undefined,
        pickupLng: form.pickupLng ?? undefined,
        pickupPlaceId: form.pickupPlaceId ?? undefined,
        delivery,
        maxDeliveryKm: deliveryZone?.maxDeliveryKm ?? null,
        deliveryRatePerKm: deliveryZone?.deliveryRatePerKm ?? null,
        deliveryFlatFee: offersDelivery ? 0 : null,
        freeDeliveryAbove:
          offersDelivery && form.freeDeliveryAbove.trim() !== ""
            ? Number(form.freeDeliveryAbove)
            : null,
      }),
    });
    const profileJson = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok) {
      setSaveError(profileJson.error ?? "Could not save logistics settings.");
      return;
    }

    markClean();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function renderDaysHours(kind: "pickup" | "delivery") {
    const days = kind === "pickup" ? form.pickupDays : form.deliveryDays;
    const windows =
      kind === "pickup" ? form.pickupWindows : form.deliveryWindows;
    const title =
      kind === "pickup" ? "Pickup days & hours" : "Delivery days & hours";

    return (
      <div className={styles.formGroup}>
        <span className={styles.formLabel}>{title}</span>
        <div className={styles.dayPillGroup}>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(kind, d)}
              className={`${styles.dayPill} ${days.includes(d) ? styles.dayPillActive : ""}`}
            >
              {d}
            </button>
          ))}
        </div>
        {days.length > 0 && (
          <div className={styles.perDayWindows}>
            {DAYS.filter((d) => days.includes(d)).map((d) => {
              const fullName = DAY_FULL[d];
              const win = windows[fullName] ?? { from: "11:00", to: "14:00" };
              return (
                <div key={d} className={styles.perDayRow}>
                  <span className={styles.perDayName}>{d}</span>
                  <div className={styles.timeRow}>
                    <input
                      type="time"
                      className={styles.formInput}
                      value={win.from}
                      onChange={(e) =>
                        setDayWindow(kind, d, "from", e.target.value)
                      }
                      aria-label={`${d} ${kind} from`}
                    />
                    <span className={styles.timeSep}>to</span>
                    <input
                      type="time"
                      className={styles.formInput}
                      value={win.to}
                      onChange={(e) =>
                        setDayWindow(kind, d, "to", e.target.value)
                      }
                      aria-label={`${d} ${kind} to`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className={styles.formHint}>
          Set a {kind} window for each day you&apos;re available.
        </p>
      </div>
    );
  }

  if (loading) {
    return <CardFormSkeleton rows={4} />;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardForm}>
        <div className={styles.formGroup}>
          <label
            htmlFor="logistics-pickup-address"
            className={styles.formLabel}
          >
            Pickup address
          </label>
          <AddressSearchInput
            id="logistics-pickup-address"
            className={styles.formInput}
            value={form.pickupStreet}
            placeholder="Start typing your address…"
            onTextChange={(text) =>
              setForm((f) => ({
                ...f,
                pickupStreet: text,
                pickupUnit: "",
                pickupCity: "",
                pickupProvince: "",
                pickupPostal: "",
                pickupLat: null,
                pickupLng: null,
                pickupPlaceId: null,
              }))
            }
            onResolve={(addr) =>
              setForm((f) => ({
                ...f,
                pickupStreet: addr.streetAddress,
                pickupUnit: "",
                pickupCity: addr.city,
                pickupProvince: addr.province,
                pickupPostal: addr.postalCode,
                pickupLat: addr.lat,
                pickupLng: addr.lng,
                pickupPlaceId: addr.placeId,
              }))
            }
          />
          {form.pickupLat != null && form.pickupLng != null ? (
            <p className={styles.formHint}>
              {formatAddressQuery({
                street: form.pickupStreet,
                city: form.pickupCity,
                province: form.pickupProvince,
                postal: form.pickupPostal,
              })}
            </p>
          ) : (
            <p className={styles.formHint}>
              Select your address from the suggestions.
            </p>
          )}
          <p className={styles.formHint}>
            Shown to customers only after their order is confirmed.
          </p>
        </div>

        <div className={styles.formGroup}>
          <span className={styles.formLabel}>Fulfillment</span>
          <div className={styles.fulfillmentGroup}>
            {FULFILLMENT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.fulfillmentCard} ${form.fulfillment === value ? styles.fulfillmentCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={value}
                  checked={form.fulfillment === value}
                  onChange={() =>
                    setForm((f) => ({
                      ...f,
                      fulfillment: value,
                      ...(value !== "pickup"
                        ? {
                            maxDeliveryKm:
                              f.maxDeliveryKm ?? defaultMaxDeliveryKm(),
                            deliveryRatePerKm: clampDeliveryRate(
                              f.deliveryRatePerKm || defaultDeliveryRate(),
                            ),
                          }
                        : {}),
                    }))
                  }
                  className={styles.fulfillmentInput}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className={styles.formHint}>
            How customers receive orders. Set days and hours for each option
            below.
          </p>
        </div>

        {offersPickup && renderDaysHours("pickup")}
        {offersDelivery && renderDaysHours("delivery")}

        <div className={styles.formGroup}>
          <label htmlFor="logistics-leadTime" className={styles.formLabel}>
            Order lead time
          </label>
          <select
            id="logistics-leadTime"
            className={styles.formInput}
            value={form.leadTime}
            onChange={(e) =>
              setForm((f) => ({ ...f, leadTime: e.target.value }))
            }
          >
            <option value="">Select lead time</option>
            {LEAD_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <LeadTimeCutoffField
          value={form.leadTimeCutoff}
          leadTime={form.leadTime}
          onChange={(value) =>
            setForm((f) => ({ ...f, leadTimeCutoff: value }))
          }
          labelClassName={styles.formLabel}
          hintClassName={styles.formHint}
        />

        {offersDelivery && (
          <div className={styles.deliveryZone}>
            <span className={styles.formLabel}>Delivery zone</span>
            <p className={styles.formHint}>
              How far you deliver and what you charge per kilometre. We
              calculate the fee for each customer at checkout.
            </p>

            <div className={styles.formGroup}>
              <label htmlFor="maxDeliveryKm" className={styles.formLabel}>
                Max delivery distance (km)
              </label>
              <input
                id="maxDeliveryKm"
                type="number"
                min={DELIVERY_MAX_KM_MIN}
                max={DELIVERY_MAX_KM_MAX}
                className={styles.formInput}
                value={form.maxDeliveryKm ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxDeliveryKm: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder={`Default ${defaultMaxDeliveryKm()} km`}
              />
            </div>

            <div className={styles.formGroup}>
              <div className={styles.deliveryRateHeader}>
                <label htmlFor="deliveryRatePerKm" className={styles.formLabel}>
                  Rate per km
                </label>
                <span className={styles.deliveryRateValue}>
                  ${form.deliveryRatePerKm.toFixed(2)}/km
                </span>
              </div>
              <input
                id="deliveryRatePerKm"
                type="range"
                min={DELIVERY_RATE_MIN}
                max={DELIVERY_RATE_MAX}
                step={DELIVERY_RATE_STEP}
                className={styles.deliveryRateSlider}
                value={form.deliveryRatePerKm}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryRatePerKm: clampDeliveryRate(
                      Number(e.target.value),
                    ),
                  }))
                }
              />
              <div className={styles.deliveryRateLabels}>
                <span>${DELIVERY_RATE_MIN.toFixed(2)}/km</span>
                <span>${DELIVERY_RATE_MAX.toFixed(2)}/km</span>
              </div>
              <p className={styles.formHint}>
                Based on typical local driving costs for home cooks ($
                {DELIVERY_RATE_MIN.toFixed(2)} to $
                {DELIVERY_RATE_MAX.toFixed(2)}
                /km). Email <strong>team@7eats.ca</strong> if you think this
                range doesn&apos;t work for your area.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="freeDeliveryAbove" className={styles.formLabel}>
                Free delivery above subtotal ($){" "}
                <span className={styles.formLabelOptional}>(optional)</span>
              </label>
              <input
                id="freeDeliveryAbove"
                type="text"
                inputMode="decimal"
                className={styles.formInput}
                value={form.freeDeliveryAbove}
                onChange={(e) => {
                  const next = e.target.value;
                  if (isPriceKeystroke(next)) {
                    setForm((f) => ({ ...f, freeDeliveryAbove: next }));
                  }
                }}
                placeholder="None (always charge delivery)"
              />
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <p
          style={{ color: "var(--red, #e23744)", padding: "0 1rem" }}
          role="alert"
        >
          {saveError}
        </p>
      )}

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={!dirty}
        >
          {saved ? "Saved" : "Save logistics"}
        </button>
      </div>
    </div>
  );
}
