"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import DocumentDropzone from "@/app/components/DocumentDropzone";
import ImageDropzone from "@/app/components/ImageDropzone";
import LeadTimeCutoffField from "@/app/components/LeadTimeCutoffField";
import RequirementsChecklist, {
  type RequirementItem,
} from "@/app/components/RequirementsChecklist";
import SetupSidebar from "@/app/components/SetupSidebar";
import StripeConnectPanel from "@/app/components/StripeConnectPanel";
import { AddressSearchInput } from "@/components/AddressSearchInput";
import { DEFAULT_LEAD_TIME_CUTOFF } from "@/lib/lead-time";
import { isValidOptionalUrl } from "@/lib/url";
import styles from "./OnboardingWizard.module.css";

// ── Constants ─────────────────────────────────────────────────

const CUISINES = [
  { label: "West African", slug: "west-african" },
  { label: "Caribbean", slug: "caribbean" },
  { label: "South Asian", slug: "south-asian" },
  { label: "East Asian", slug: "east-asian" },
  { label: "Southeast Asian", slug: "southeast-asian" },
  { label: "Middle Eastern", slug: "middle-eastern" },
  { label: "Mediterranean", slug: "mediterranean" },
  { label: "Latin American", slug: "latin-american" },
  { label: "East African", slug: "east-african" },
  { label: "Soul Food / Southern", slug: "soul-food-southern" },
  { label: "Other", slug: "other" },
];

const NICHES = [
  { label: "General meal prep", slug: "general-meal-prep" },
  { label: "High-protein / Gym", slug: "high-protein-gym" },
  { label: "Weight loss", slug: "weight-loss" },
  { label: "Bulking / Mass gain", slug: "bulking-mass-gain" },
  { label: "Family meals", slug: "family-meals" },
  { label: "Breakfast / Brunch", slug: "breakfast-brunch" },
  { label: "Office lunches", slug: "office-lunches" },
  { label: "Student-friendly", slug: "student-friendly" },
  { label: "Post-workout recovery", slug: "post-workout-recovery" },
  { label: "Senior nutrition", slug: "senior-nutrition" },
];

const DIETARY_TAGS = [
  { label: "Halal", slug: "halal" },
  { label: "Vegan", slug: "vegan" },
  { label: "Vegetarian", slug: "vegetarian" },
  { label: "Gluten-free", slug: "gluten-free" },
  { label: "Kosher", slug: "kosher" },
  { label: "Nut-free", slug: "nut-free" },
  { label: "Dairy-free", slug: "dairy-free" },
  { label: "Low-carb / Keto", slug: "low-carb-keto" },
  { label: "High-protein", slug: "high-protein" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_FULL: Record<string, string> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

const LEAD_TIME_OPTIONS = [
  { value: "same_day", label: "Same day" },
  { value: "1_day", label: "1 day before" },
  { value: "2_days", label: "2 days before" },
  { value: "3_days", label: "3 days before" },
  { value: "4_days", label: "4 days before" },
  { value: "5_days", label: "5 days before" },
];

// ── Types ──────────────────────────────────────────────────────

type FulfillmentType = "pickup" | "delivery" | "both";

const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string }[] = [
  { value: "pickup", label: "Pickup only" },
  { value: "delivery", label: "Delivery only" },
  { value: "both", label: "Pickup & delivery" },
];

type FormState = {
  // Step 1
  displayName: string;
  photoFileName: string;
  existingPhotoUrl: string | null;
  bannerFileName: string;
  existingBannerUrl: string | null;
  bio: string;
  cuisines: string[]; // slugs
  niches: string[]; // slugs
  dietaryTags: string[]; // slugs
  socialLink: string;
  // Step 2
  pickupStreet: string;
  pickupUnit: string;
  pickupCity: string;
  pickupProvince: string;
  pickupPostal: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupPlaceId: string;
  pickupWindows: Record<string, { from: string; to: string }>;
  pickupDays: string[];
  deliveryWindows: Record<string, { from: string; to: string }>;
  deliveryDays: string[];
  fulfillment: FulfillmentType;
  leadTime: string;
  leadTimeCutoff: string;
  acceptsSpecialRequests: boolean;
  cancellationAllowed: boolean;
  // Step 3
  certPhotoFileName: string;
  // Step 4
  stripeConnected: boolean;
  tosAccepted: boolean;
};

type InitialData = {
  displayName: string;
  bio: string;
  photoUrl: string | null;
  bannerUrl: string | null;
  socialLink: string;
  pickupStreet?: string;
  pickupUnit?: string;
  pickupCity?: string;
  pickupProvince?: string;
  pickupPostal?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupPlaceId?: string;
  pickupWindows: Array<{ day: string; from: string; to: string }>;
  deliveryWindows?: Array<{ day: string; from: string; to: string }>;
  leadTime: string;
  leadTimeCutoff?: string;
  delivery: string;
  offersPickup?: boolean;
  acceptsSpecialRequests: boolean;
  cancellationAllowed?: boolean;
  selectedTagSlugs: string[];
  tagOptions?: {
    cuisines: Array<{ slug: string; label: string }>;
    niches: Array<{ slug: string; label: string }>;
    dietary: Array<{ slug: string; label: string }>;
  };
  currentSetupStep?: number;
  platformFeePct?: string | null;
  stripeConnected?: boolean;
  certPhotoFileName?: string;
  tosAccepted?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────

function toggleList(list: string[], val: string): string[] {
  return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
}

function parseWizardStep(raw: string | null): number {
  const n = Number(raw ?? "1");
  return n >= 1 && n <= 4 ? n : 1;
}

const ONBOARDING_PATH = "/business-auth/setup/onboarding";

function completedSidebarSteps(
  currentSetupStep: number,
  sessionSteps: number[],
): number[] {
  const fromDb = [1, 2];
  if (currentSetupStep >= 2) fromDb.push(3);
  if (currentSetupStep >= 3) fromDb.push(4);
  if (currentSetupStep >= 4) fromDb.push(5);
  const fromSession = sessionSteps.map((s) => s + 2);
  return [...new Set([...fromDb, ...fromSession])];
}

// ── Component ──────────────────────────────────────────────────

export default function OnboardingWizard({
  initialData,
}: {
  initialData?: InitialData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = parseWizardStep(searchParams.get("step"));
  const [step, setStep] = useState(urlStep);

  useEffect(() => {
    setStep(urlStep);
  }, [urlStep]);

  const cuisineOptions = initialData?.tagOptions?.cuisines?.length
    ? initialData.tagOptions.cuisines
    : CUISINES;
  const nicheOptions = initialData?.tagOptions?.niches?.length
    ? initialData.tagOptions.niches
    : NICHES;
  const dietaryOptions = initialData?.tagOptions?.dietary?.length
    ? initialData.tagOptions.dietary
    : DIETARY_TAGS;

  const allCuisineSlugs = cuisineOptions.map((c) => c.slug);
  const allNicheSlugs = nicheOptions.map((n) => n.slug);
  const allDietarySlugs = dietaryOptions.map((d) => d.slug);

  const [form, setForm] = useState<FormState>({
    displayName: initialData?.displayName ?? "",
    photoFileName: "",
    existingPhotoUrl: initialData?.photoUrl ?? null,
    bannerFileName: "",
    existingBannerUrl: initialData?.bannerUrl ?? null,
    bio: initialData?.bio ?? "",
    cuisines:
      initialData?.selectedTagSlugs.filter((s) =>
        allCuisineSlugs.includes(s),
      ) ?? [],
    niches:
      initialData?.selectedTagSlugs.filter((s) => allNicheSlugs.includes(s)) ??
      [],
    dietaryTags:
      initialData?.selectedTagSlugs.filter((s) =>
        allDietarySlugs.includes(s),
      ) ?? [],
    socialLink: initialData?.socialLink ?? "",
    pickupStreet: initialData?.pickupStreet ?? "",
    pickupUnit: initialData?.pickupUnit ?? "",
    pickupCity: initialData?.pickupCity ?? "",
    pickupProvince: initialData?.pickupProvince ?? "",
    pickupPostal: initialData?.pickupPostal ?? "",
    pickupLat: initialData?.pickupLat ?? null,
    pickupLng: initialData?.pickupLng ?? null,
    pickupPlaceId: initialData?.pickupPlaceId ?? "",
    pickupWindows: Object.fromEntries(
      (initialData?.pickupWindows ?? []).map((w) => [
        w.day,
        { from: w.from, to: w.to },
      ]),
    ),
    pickupDays: (initialData?.pickupWindows ?? []).map((w) => {
      const short = Object.entries(DAY_FULL).find(
        ([, full]) => full === w.day,
      )?.[0];
      return short ?? w.day;
    }),
    deliveryWindows: Object.fromEntries(
      (initialData?.deliveryWindows ?? []).map((w) => [
        w.day,
        { from: w.from, to: w.to },
      ]),
    ),
    deliveryDays: (initialData?.deliveryWindows ?? []).map((w) => {
      const short = Object.entries(DAY_FULL).find(
        ([, full]) => full === w.day,
      )?.[0];
      return short ?? w.day;
    }),
    fulfillment: (() => {
      const offersPickup = initialData?.offersPickup ?? true;
      const offersDelivery = initialData?.delivery === "self";
      if (offersPickup && offersDelivery) return "both";
      return offersDelivery ? "delivery" : "pickup";
    })(),
    leadTime: initialData?.leadTime ?? "",
    leadTimeCutoff: initialData?.leadTimeCutoff ?? DEFAULT_LEAD_TIME_CUTOFF,
    acceptsSpecialRequests: initialData?.acceptsSpecialRequests ?? false,
    cancellationAllowed: initialData?.cancellationAllowed ?? false,
    certPhotoFileName: initialData?.certPhotoFileName ?? "",
    stripeConnected: initialData?.stripeConnected ?? false,
    tosAccepted: initialData?.tosAccepted ?? false,
  });

  const [completed, setCompleted] = useState<number[]>([]);
  const [stepError, setStepError] = useState("");
  const [isPending, startTransition] = useTransition();
  const photoFileRef = useRef<File | null>(null);
  const bannerFileRef = useRef<File | null>(null);
  const certFileRef = useRef<File | null>(null);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const markDone = () => setCompleted((prev) => [...new Set([...prev, step])]);

  const validate = (): boolean => {
    if (step === 1) {
      if (!form.displayName.trim()) {
        setStepError("Display name is required.");
        return false;
      }
      if (!form.existingPhotoUrl && !form.photoFileName) {
        setStepError("Add a profile photo to continue.");
        return false;
      }
      if (form.bio.trim().length < 100) {
        setStepError("Bio must be at least 100 characters.");
        return false;
      }
      if (form.cuisines.length === 0) {
        setStepError("Select at least one cuisine type.");
        return false;
      }
      if (!isValidOptionalUrl(form.socialLink)) {
        setStepError("Enter a valid social link URL, or leave it blank.");
        return false;
      }
    }
    if (step === 2) {
      if (
        !form.pickupStreet.trim() ||
        !form.pickupCity.trim() ||
        !form.pickupProvince.trim() ||
        !form.pickupPostal.trim() ||
        form.pickupLat === null ||
        form.pickupLng === null
      ) {
        setStepError(
          "A valid geocoded pickup address is required. Please select from the suggestions.",
        );
        return false;
      }
      const offersPickup = form.fulfillment !== "delivery";
      const offersDelivery = form.fulfillment !== "pickup";
      if (offersPickup && form.pickupDays.length === 0) {
        setStepError("Add at least one pickup day.");
        return false;
      }
      if (offersDelivery && form.deliveryDays.length === 0) {
        setStepError("Add at least one delivery day.");
        return false;
      }
      if (!form.leadTime) {
        setStepError("Select an order lead time.");
        return false;
      }
    }
    if (step === 3) {
      if (!form.certPhotoFileName) {
        setStepError("Upload a photo of your certificate to continue.");
        return false;
      }
    }
    if (step === 4) {
      if (!form.stripeConnected) {
        setStepError("Connect your Stripe account to continue.");
        return false;
      }
      if (!form.tosAccepted) {
        setStepError("Accept the terms of service to continue.");
        return false;
      }
    }
    return true;
  };

  // Mirrors validate()'s mandatory checks without side effects, to drive the
  // button's disabled look and the requirements checklist (same pattern as
  // the application form).
  const stepRequirements: RequirementItem[] = ((): RequirementItem[] => {
    if (step === 1) {
      const bioLen = form.bio.trim().length;
      const items: RequirementItem[] = [
        { label: "Display name added", met: form.displayName.trim() !== "" },
        {
          label: "Profile photo added",
          met: form.existingPhotoUrl !== null || form.photoFileName !== "",
        },
        {
          label:
            bioLen < 100
              ? `Bio is at least 100 characters (${bioLen}/100)`
              : "Bio is at least 100 characters",
          met: bioLen >= 100 && bioLen <= 500,
        },
        {
          label: "At least 1 cuisine type selected",
          met: form.cuisines.length > 0,
        },
      ];
      if (form.socialLink.trim() !== "") {
        items.push({
          label: "Social link is a valid URL",
          met: isValidOptionalUrl(form.socialLink),
        });
      }
      return items;
    }
    if (step === 2) {
      const offersPickup = form.fulfillment !== "delivery";
      const offersDelivery = form.fulfillment !== "pickup";
      const items: RequirementItem[] = [
        {
          label: "Valid pickup address selected",
          met:
            form.pickupStreet.trim() !== "" &&
            form.pickupCity.trim() !== "" &&
            form.pickupProvince.trim() !== "" &&
            form.pickupPostal.trim() !== "" &&
            form.pickupLat !== null &&
            form.pickupLng !== null,
        },
      ];
      if (offersPickup) {
        items.push({
          label: "At least 1 pickup day selected",
          met: form.pickupDays.length > 0,
        });
      }
      if (offersDelivery) {
        items.push({
          label: "At least 1 delivery day selected",
          met: form.deliveryDays.length > 0,
        });
      }
      items.push({
        label: "Order lead time selected",
        met: form.leadTime !== "",
      });
      return items;
    }
    if (step === 3) {
      return [
        {
          label: "Certificate photo uploaded",
          met: form.certPhotoFileName !== "",
        },
      ];
    }
    if (step === 4) {
      return [
        { label: "Stripe account connected", met: form.stripeConnected },
        { label: "Terms of service accepted", met: form.tosAccepted },
      ];
    }
    return [];
  })();

  const stepComplete = stepRequirements.every((r) => r.met);

  const advance = () => {
    setStepError("");
    if (!validate()) return;

    if (step === 1) {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("displayName", form.displayName);
        fd.set("bio", form.bio);
        fd.set("socialLink", form.socialLink);
        fd.set("cuisines", form.cuisines.join(","));
        fd.set("niches", form.niches.join(","));
        fd.set("dietary", form.dietaryTags.join(","));
        if (photoFileRef.current) fd.set("photo", photoFileRef.current);
        if (bannerFileRef.current) fd.set("banner", bannerFileRef.current);
        const res = await fetch("/api/setup/onboarding/1", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setStepError(data.error ?? "Something went wrong.");
          return;
        }
        markDone();
        router.push("/business-auth/setup/onboarding?step=2");
      });
      return;
    }

    if (step === 2) {
      const offersPickup = form.fulfillment !== "delivery";
      const offersDelivery = form.fulfillment !== "pickup";
      startTransition(async () => {
        const res = await fetch("/api/setup/onboarding/2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupStreet: form.pickupStreet,
            pickupUnit: form.pickupUnit,
            pickupCity: form.pickupCity,
            pickupProvince: form.pickupProvince,
            pickupPostal: form.pickupPostal,
            pickupLat: form.pickupLat,
            pickupLng: form.pickupLng,
            pickupPlaceId: form.pickupPlaceId,
            offersPickup,
            pickupWindows: offersPickup
              ? Object.entries(form.pickupWindows).map(([day, win]) => ({
                  day,
                  from: win.from,
                  to: win.to,
                }))
              : [],
            deliveryWindows: offersDelivery
              ? Object.entries(form.deliveryWindows).map(([day, win]) => ({
                  day,
                  from: win.from,
                  to: win.to,
                }))
              : [],
            leadTime: form.leadTime,
            leadTimeCutoff: form.leadTimeCutoff,
            cancellationAllowed: form.cancellationAllowed,
            delivery: offersDelivery ? "self" : "none",
            acceptsSpecialRequests: form.acceptsSpecialRequests,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStepError(data.error ?? "Something went wrong.");
          return;
        }
        markDone();
        router.push("/business-auth/setup/onboarding?step=3");
      });
      return;
    }

    if (step === 3) {
      startTransition(async () => {
        const fd = new FormData();
        if (certFileRef.current) fd.set("certPhoto", certFileRef.current);
        const res = await fetch("/api/setup/onboarding/3", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setStepError(data.error ?? "Something went wrong.");
          return;
        }
        markDone();
        router.push("/business-auth/setup/onboarding?step=4");
      });
      return;
    }

    if (step === 4) {
      startTransition(async () => {
        const res = await fetch("/api/setup/onboarding/4", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tosAccepted: form.tosAccepted }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStepError(data.error ?? "Something went wrong.");
          return;
        }
        router.push("/business/dashboard");
      });
      return;
    }
  };

  const goBack = () => {
    if (step === 1) {
      router.push("/business-auth/setup/verify-phone");
      return;
    }
    const prev = step - 1;
    setStep(prev);
    window.history.replaceState(null, "", `${ONBOARDING_PATH}?step=${prev}`);
  };

  return (
    <div className={styles.page}>
      <SetupSidebar
        activeStep={step + 2}
        completedSteps={completedSidebarSteps(
          initialData?.currentSetupStep ?? 1,
          completed,
        )}
      />

      <main className={styles.right}>
        <div className={styles.rightInner}>
          {step === 1 && (
            <Step1
              form={form}
              set={set}
              photoFileRef={photoFileRef}
              bannerFileRef={bannerFileRef}
              cuisineOptions={cuisineOptions}
              nicheOptions={nicheOptions}
              dietaryOptions={dietaryOptions}
            />
          )}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && (
            <Step3
              form={form}
              set={set}
              certFileRef={certFileRef}
              onCompleteLater={() => router.push("/business/dashboard")}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              set={set}
              platformFeePct={initialData?.platformFeePct ?? null}
              onCompleteLater={() => router.push("/business/dashboard")}
              onStripeConnectedChange={(connected) =>
                set("stripeConnected", connected)
              }
            />
          )}

          {stepError && (
            <p className={styles.stepError} role="alert">
              {stepError}
            </p>
          )}

          {!stepComplete && (
            <div className={styles.requirementsWrap}>
              <p className={styles.requirementsHeading}>To continue:</p>
              <RequirementsChecklist items={stepRequirements} />
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-primary ${styles.ctaBtn} ${!stepComplete ? styles.ctaBtnDisabled : ""}`}
              onClick={advance}
              disabled={isPending}
              aria-disabled={!stepComplete}
            >
              {isPending
                ? "Saving…"
                : step === 4
                  ? "Complete setup"
                  : "Save and continue"}
            </button>
            {step > 1 && (
              <button
                type="button"
                className={styles.laterBtn}
                onClick={goBack}
                disabled={isPending}
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Step sub-components ────────────────────────────────────────

function Step1({
  form,
  set,
  photoFileRef,
  bannerFileRef,
  cuisineOptions,
  nicheOptions,
  dietaryOptions,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  photoFileRef: React.MutableRefObject<File | null>;
  bannerFileRef: React.MutableRefObject<File | null>;
  cuisineOptions: Array<{ slug: string; label: string }>;
  nicheOptions: Array<{ slug: string; label: string }>;
  dietaryOptions: Array<{ slug: string; label: string }>;
}) {
  const bioLen = form.bio.trim().length;

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 3 of 6</p>
        <h2 className={styles.formTitle}>Cook profile</h2>
        <p className={styles.formSub}>
          This is what customers see when they browse your kitchen on 7eats.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="displayName" className={styles.label}>
            Display name <span className={styles.requiredStar}>*</span>
          </label>
          <input
            id="displayName"
            type="text"
            className={styles.input}
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="e.g. Mama Olu's Kitchen"
          />
          <p className={styles.hint}>
            What customers see. Edit if you want a different name than what you
            applied with.
          </p>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Profile photo <span className={styles.requiredStar}>*</span>
          </span>
          <ImageDropzone
            id="profile-photo"
            variant="avatar"
            existingUrl={form.existingPhotoUrl}
            alt="Profile photo"
            onFile={(file) => {
              photoFileRef.current = file;
              set("photoFileName", file?.name ?? "");
            }}
            note={
              form.photoFileName
                ? form.photoFileName
                : form.existingPhotoUrl
                  ? "Current photo uploaded"
                  : "JPEG or PNG · min 400x400 · required"
            }
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Banner image <span className={styles.labelNote}>(optional)</span>
          </span>
          <ImageDropzone
            id="banner-image"
            variant="banner"
            existingUrl={form.existingBannerUrl}
            alt="Banner image"
            onFile={(file) => {
              bannerFileRef.current = file;
              set("bannerFileName", file?.name ?? "");
            }}
            note={
              form.bannerFileName
                ? form.bannerFileName
                : form.existingBannerUrl
                  ? "Current banner uploaded"
                  : "JPEG or PNG · wide image · shown across your kitchen page"
            }
          />
          <p className={styles.hint}>
            The wide cover image customers see at the top of your kitchen page.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="bio" className={styles.label}>
            Bio <span className={styles.requiredStar}>*</span>{" "}
            <span
              className={`${styles.charCount} ${bioLen < 100 ? styles.charCountUnder : ""}`}
            >
              {bioLen < 100 ? `${bioLen} / 100 min` : `${bioLen} / 500`}
            </span>
          </label>
          <textarea
            id="bio"
            className={styles.textarea}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Tell customers about your cooking. What you make, what makes it yours, where you learned. Minimum 100 characters."
            rows={5}
            maxLength={500}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Cuisine types <span className={styles.requiredStar}>*</span>
          </span>
          <div className={styles.pillGroup}>
            {cuisineOptions.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() =>
                  set("cuisines", toggleList(form.cuisines, c.slug))
                }
                className={`${styles.pill} ${form.cuisines.includes(c.slug) ? styles.pillActive : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Niche <span className={styles.labelNote}>(optional)</span>
          </span>
          <div className={styles.pillGroup}>
            {nicheOptions.map((n) => (
              <button
                key={n.slug}
                type="button"
                onClick={() => set("niches", toggleList(form.niches, n.slug))}
                className={`${styles.pill} ${form.niches.includes(n.slug) ? styles.pillActive : ""}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Dietary tags <span className={styles.labelNote}>(optional)</span>
          </span>
          <div className={styles.pillGroup}>
            {dietaryOptions.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() =>
                  set("dietaryTags", toggleList(form.dietaryTags, t.slug))
                }
                className={`${styles.pill} ${form.dietaryTags.includes(t.slug) ? styles.pillActive : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="socialLink" className={styles.label}>
            Instagram or social link{" "}
            <span className={styles.labelNote}>(optional)</span>
          </label>
          <input
            id="socialLink"
            type="url"
            className={styles.input}
            value={form.socialLink}
            onChange={(e) => set("socialLink", e.target.value)}
            placeholder="instagram.com/yourkitchen"
          />
        </div>
      </div>
    </div>
  );
}

function Step2({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const offersPickup = form.fulfillment !== "delivery";
  const offersDelivery = form.fulfillment !== "pickup";

  const toggleDay = (kind: "pickup" | "delivery", d: string) => {
    const fullName = DAY_FULL[d] ?? d.toLowerCase();
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
  };

  const setDayWindow = (
    kind: "pickup" | "delivery",
    d: string,
    field: "from" | "to",
    value: string,
  ) => {
    const fullName = DAY_FULL[d] ?? d.toLowerCase();
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
  };

  const renderDaysHours = (kind: "pickup" | "delivery") => {
    const days = kind === "pickup" ? form.pickupDays : form.deliveryDays;
    const windows =
      kind === "pickup" ? form.pickupWindows : form.deliveryWindows;
    const title =
      kind === "pickup" ? "Pickup days & hours" : "Delivery days & hours";
    return (
      <div className={styles.field}>
        <span className={styles.label}>
          {title} <span className={styles.requiredStar}>*</span>
        </span>
        <div className={styles.pillGroup}>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(kind, d)}
              className={`${styles.pill} ${days.includes(d) ? styles.pillActive : ""}`}
            >
              {d}
            </button>
          ))}
        </div>
        {days.length > 0 && (
          <div className={styles.perDayWindows}>
            {DAYS.filter((d) => days.includes(d)).map((d) => {
              const fullName = DAY_FULL[d] ?? d.toLowerCase();
              const win = windows[fullName] ?? { from: "11:00", to: "14:00" };
              return (
                <div key={d} className={styles.perDayRow}>
                  <span className={styles.perDayName}>{d}</span>
                  <div className={styles.timeRow}>
                    <input
                      type="time"
                      className={styles.input}
                      value={win.from}
                      onChange={(e) =>
                        setDayWindow(kind, d, "from", e.target.value)
                      }
                      aria-label={`${d} ${kind} from`}
                    />
                    <span className={styles.timeSep}>-</span>
                    <input
                      type="time"
                      className={styles.input}
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
        <p className={styles.hint}>
          {`Set a ${kind} window for each day you're available.`}
        </p>
      </div>
    );
  };

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <p className={styles.formStep}>Step 4 of 6</p>
        <h2 className={styles.formTitle}>Operations</h2>
        <p className={styles.formSub}>
          How you run your kitchen day to day. Customers see your schedule when
          browsing - pickup times, delivery windows, and prep lead time.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.label}>
            Pickup Address <span className={styles.requiredStar}>*</span>
          </span>
          <AddressSearchInput
            id="onboarding-pickup"
            className={styles.input}
            value={form.pickupStreet}
            onTextChange={(text) =>
              // Manual typing clears the prior pick - only a selected
              // suggestion counts as a valid, geocoded address.
              setForm((f) => ({
                ...f,
                pickupStreet: text,
                pickupUnit: "",
                pickupCity: "",
                pickupProvince: "",
                pickupPostal: "",
                pickupLat: null,
                pickupLng: null,
                pickupPlaceId: "",
              }))
            }
            onResolve={(a) =>
              setForm((f) => ({
                ...f,
                pickupStreet: a.streetAddress,
                pickupUnit: "",
                pickupCity: a.city,
                pickupProvince: a.province,
                pickupPostal: a.postalCode,
                pickupLat: a.lat,
                pickupLng: a.lng,
                pickupPlaceId: a.placeId,
              }))
            }
          />
          {form.pickupLat !== null && form.pickupLng !== null ? (
            <p className={styles.addressConfirm}>
              {[
                form.pickupStreet,
                form.pickupCity,
                form.pickupProvince,
                form.pickupPostal,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : (
            <p className={styles.hint}>
              Select your address from the suggestions.
            </p>
          )}
          <p className={styles.hint}>
            Only revealed to customers after their order is confirmed.
          </p>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Fulfillment</span>
          <div className={styles.radioGroup}>
            {FULFILLMENT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.radioCard} ${form.fulfillment === value ? styles.radioCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={value}
                  checked={form.fulfillment === value}
                  onChange={() =>
                    setForm((f) => ({ ...f, fulfillment: value }))
                  }
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{label}</span>
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            How customers receive their orders. Set availability for each option
            you offer below.
          </p>
        </div>

        {offersPickup && renderDaysHours("pickup")}
        {offersDelivery && renderDaysHours("delivery")}

        <div className={styles.field}>
          <span className={styles.label}>
            Order lead time <span className={styles.requiredStar}>*</span>
          </span>
          <div className={styles.radioGroup}>
            {LEAD_TIME_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`${styles.radioCard} ${form.leadTime === value ? styles.radioCardActive : ""}`}
              >
                <input
                  type="radio"
                  name="leadTime"
                  value={value}
                  checked={form.leadTime === value}
                  onChange={() => setForm((f) => ({ ...f, leadTime: value }))}
                  className={styles.radioInput}
                />
                <span className={styles.radioLabel}>{label}</span>
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            Customers ordering after this cutoff are booked for the next
            available{" "}
            {offersPickup && offersDelivery
              ? "pickup or delivery day"
              : offersDelivery
                ? "delivery day"
                : "pickup day"}
            . Cancellations before it receive a full refund; no refund after.
          </p>
        </div>

        <LeadTimeCutoffField
          value={form.leadTimeCutoff}
          leadTime={form.leadTime}
          onChange={(value) =>
            setForm((f) => ({ ...f, leadTimeCutoff: value }))
          }
          fulfillmentMode={form.fulfillment}
          pickupWindows={form.pickupDays.map((d) => {
            const dayOfWeek = DAY_FULL[d] ?? d.toLowerCase();
            const win = form.pickupWindows[dayOfWeek] ?? {
              from: "11:00",
              to: "14:00",
            };
            return {
              dayOfWeek,
              fromTime: win.from,
              toTime: win.to,
            };
          })}
          deliveryWindows={form.deliveryDays.map((d) => {
            const dayOfWeek = DAY_FULL[d] ?? d.toLowerCase();
            const win = form.deliveryWindows[dayOfWeek] ?? {
              from: "11:00",
              to: "14:00",
            };
            return {
              dayOfWeek,
              fromTime: win.from,
              toTime: win.to,
            };
          })}
          hintClassName={styles.hint}
          labelClassName={styles.label}
        />

        <div className={styles.field}>
          <span className={styles.label}>Special requests</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.acceptsSpecialRequests}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  acceptsSpecialRequests: e.target.checked,
                }))
              }
            />
            <span className={styles.checkLabel}>
              I accept ingredient swaps and special requests from customers.
              They can add a note when ordering.
            </span>
          </label>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Cancellation policy</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.cancellationAllowed}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cancellationAllowed: e.target.checked,
                }))
              }
            />
            <span className={styles.checkLabel}>
              After I confirm an order, allow a full refund if the customer
              cancels before my lead time. If unchecked, confirmed orders are
              final. Customers can always cancel with a full refund before I
              confirm.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Step3({
  form,
  set,
  certFileRef,
  onCompleteLater,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  certFileRef: React.MutableRefObject<File | null>;
  onCompleteLater: () => void;
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <div className={styles.formHeadTop}>
          <p className={styles.formStep}>Step 5 of 6</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCompleteLater}
          >
            Complete later
          </button>
        </div>
        <h2 className={styles.formTitle}>Compliance</h2>
        <p className={styles.formSub}>
          Upload a photo of your food handler certificate. Our team reviews the
          details before your menu goes live.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="cert-photo" className={styles.label}>
            Photo of certificate <span className={styles.requiredStar}>*</span>
          </label>
          <DocumentDropzone
            id="cert-photo"
            fileName={form.certPhotoFileName || undefined}
            onFile={(file) => {
              certFileRef.current = file;
              set("certPhotoFileName", file?.name ?? "");
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Step4({
  form,
  set,
  platformFeePct,
  onCompleteLater,
  onStripeConnectedChange,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  platformFeePct: string | null;
  onCompleteLater: () => void;
  onStripeConnectedChange: (connected: boolean) => void;
}) {
  const feeLabel =
    platformFeePct != null && platformFeePct !== ""
      ? `${Number(platformFeePct)}% per order`
      : "7.5% per order";

  return (
    <div className={styles.stepContent}>
      <div className={styles.formHead}>
        <div className={styles.formHeadTop}>
          <p className={styles.formStep}>Step 6 of 6</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCompleteLater}
          >
            Complete later
          </button>
        </div>
        <h2 className={styles.formTitle}>Get paid</h2>
        <p className={styles.formSub}>
          Connect your bank account and you are ready to receive your first
          order.
        </p>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <span className={styles.label}>Payments</span>
          <StripeConnectPanel
            layout="card"
            returnTo="/business-auth/setup/onboarding?step=4"
            onConnectedChange={onStripeConnectedChange}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Platform terms</span>
          <div className={styles.termsList}>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Platform fee</span>
              <span className={styles.termsItemValue}>{feeLabel}</span>
            </div>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Refunds</span>
              <span className={styles.termsItemValue}>
                Full refund before order cutoff
              </span>
            </div>
            <div className={styles.termsItem}>
              <span className={styles.termsItemLabel}>Payouts</span>
              <span className={styles.termsItemValue}>
                Direct deposit via Stripe
              </span>
            </div>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Terms of service</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={form.tosAccepted}
              onChange={(e) => set("tosAccepted", e.target.checked)}
            />
            <span className={styles.checkLabel}>
              I have read and agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                7eats Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
