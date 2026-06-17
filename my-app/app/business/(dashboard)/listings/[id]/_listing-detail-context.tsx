"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SubscriptionInterval } from "@/lib/subscription-schedule";

export type ListingStatus = "active" | "draft" | "archived";
export type UiDealType = "percentage_off" | "fixed_off";

export type PricingTier = {
  id: string;
  minQty: number;
  pricePerUnit: string;
};

export type ListingDish = {
  id: string;
  dishId: string;
  name: string;
  cuisine: string;
  sortOrder: number;
};

export type AvailableDish = {
  id: string;
  name: string;
  cuisine: string;
};

export type ListingDeal = {
  id: string;
  type: UiDealType;
  value: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usesCount: number;
};

export type ListingOrder = {
  id: string;
  customerName: string;
  quantity: number;
  totalPrice: string;
  pickupAt: string;
  status: "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled";
};

export type ListingReview = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  date: string;
};

export type ListingStats = {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
};

export type SubscriptionTier = {
  id: string;
  interval: SubscriptionInterval;
  price: string;
  isActive: boolean;
};

type ApiTier = {
  id: string;
  interval: SubscriptionInterval;
  price: string;
  isActive: boolean;
};

type ApiBundle = { id: string; quantity: number; price: string };
type ApiDeal = {
  id: string;
  type: string;
  value: string | null;
  validFrom: string | Date | null;
  validUntil: string | Date | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
};

function mapSubscriptionTier(t: ApiTier): SubscriptionTier {
  return {
    id: t.id,
    interval: t.interval,
    price: t.price,
    isActive: t.isActive,
  };
}

function bundleToTier(b: ApiBundle): PricingTier {
  const qty = b.quantity;
  const total = Number(b.price);
  return {
    id: b.id,
    minQty: qty,
    pricePerUnit: qty > 0 ? (total / qty).toFixed(2) : "",
  };
}

function toIsoDate(date: string | Date | null): string | null {
  if (!date) return null;
  return typeof date === "string" ? date : date.toISOString();
}

function mapDeal(d: ApiDeal): ListingDeal {
  return {
    id: d.id,
    type: d.type as UiDealType,
    value: d.value != null ? Number(d.value) : 0,
    isActive: d.isActive,
    validFrom: toIsoDate(d.validFrom),
    validUntil: toIsoDate(d.validUntil),
    maxUses: d.maxUses,
    usesCount: d.usesCount,
  };
}

type ListingMeta = {
  title: string;
  description: string;
  basePrice: string;
  currency: string;
  minOrderQty: number;
  maxOrderQty: number | null;
  status: ListingStatus;
  subscriptionEnabled: boolean;
  coverPhotoUrl: string | null;
};

type ListingDetailContextValue = {
  listingId: string;
  loading: boolean;
  error: string | null;
  stats: ListingStats;
  listing: ListingMeta | null;
  bundles: ApiBundle[];
  subscriptionTiers: SubscriptionTier[];
  hasActiveOrders: boolean;
  dishes: ListingDish[];
  setDishes: React.Dispatch<React.SetStateAction<ListingDish[]>>;
  availableDishes: AvailableDish[];
  deals: ListingDeal[];
  setDeals: React.Dispatch<React.SetStateAction<ListingDeal[]>>;
  orders: ListingOrder[];
  reviews: ListingReview[];
  saveOverview: (payload: {
    title: string;
    description: string;
    basePrice: string;
    currency: string;
    minOrderQty: number;
    maxOrderQty: string;
    status: ListingStatus;
    tiers: PricingTier[];
    subscriptionEnabled: boolean;
  }) => Promise<boolean>;
  saveSubscriptionTiers: (
    tiers: {
      interval: SubscriptionInterval;
      price: string;
      enabled: boolean;
    }[],
  ) => Promise<void>;
  addDish: (dish: AvailableDish) => Promise<boolean>;
  removeDish: (dish: ListingDish) => Promise<boolean>;
  persistDishOrder: (ordered: ListingDish[]) => Promise<void>;
  createDeal: (deal: {
    type: UiDealType;
    value: string;
    validFrom: string;
    validUntil: string;
    maxUses: string;
  }) => Promise<string | null>;
  deleteDeal: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
};

const ListingDetailContext = createContext<ListingDetailContextValue | null>(
  null,
);

export function useListingDetail() {
  const ctx = useContext(ListingDetailContext);
  if (!ctx) {
    throw new Error(
      "useListingDetail must be used within ListingDetailProvider",
    );
  }
  return ctx;
}

export function ListingDetailProvider({
  listingId,
  children,
}: {
  listingId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ListingStats>({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  });
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [dishes, setDishes] = useState<ListingDish[]>([]);
  const [availableDishes, setAvailableDishes] = useState<AvailableDish[]>([]);
  const [deals, setDeals] = useState<ListingDeal[]>([]);
  const [orders, setOrders] = useState<ListingOrder[]>([]);
  const [reviews, setReviews] = useState<ListingReview[]>([]);
  const [bundles, setBundles] = useState<ApiBundle[]>([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState<
    SubscriptionTier[]
  >([]);
  const [listingMeta, setListingMeta] = useState<ListingMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        listingRes,
        bundlesRes,
        promosRes,
        ordersRes,
        reviewsRes,
        allDishesRes,
      ] = await Promise.all([
        fetch(`/api/business/listings/${listingId}`),
        fetch(`/api/business/listings/${listingId}/bundles`),
        fetch(`/api/business/listings/${listingId}/promotions`),
        fetch(
          `/api/business/dashboard/orders?listingId=${listingId}&limit=100`,
        ),
        fetch(
          `/api/business/dashboard/reviews?listingId=${listingId}&limit=100`,
        ),
        fetch("/api/business/listings/dishes?status=active"),
      ]);

      if (!listingRes.ok) {
        setError("Listing not found.");
        return;
      }

      const listingJson = await listingRes.json();
      const listing = listingJson.data;
      setStats(
        listing.stats ?? {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
        },
      );
      setListingMeta({
        title: listing.title,
        description: listing.description ?? "",
        basePrice: String(listing.basePrice),
        currency: listing.currency,
        minOrderQty: listing.minOrderQty,
        maxOrderQty: listing.maxOrderQty,
        status: listing.status as ListingStatus,
        subscriptionEnabled: listing.subscriptionEnabled ?? false,
        coverPhotoUrl: listing.coverPhotoUrl ?? null,
      });
      setSubscriptionTiers(
        ((listing.tiers ?? []) as ApiTier[]).map(mapSubscriptionTier),
      );
      setDishes(
        (listing.dishes ?? []).map(
          (d: {
            id: string;
            dishId: string;
            name: string;
            cuisine: string | null;
            sortOrder: number;
          }) => ({
            id: d.id,
            dishId: d.dishId,
            name: d.name,
            cuisine: d.cuisine ?? "",
            sortOrder: d.sortOrder,
          }),
        ),
      );

      if (bundlesRes.ok) {
        const bJson = await bundlesRes.json();
        setBundles(bJson.data ?? []);
      }
      if (promosRes.ok) {
        const pJson = await promosRes.json();
        setDeals((pJson.data ?? []).map(mapDeal));
      }
      if (ordersRes.ok) {
        const oJson = await ordersRes.json();
        const rows = oJson.data ?? [];
        setHasActiveOrders(
          rows.some(
            (o: { status: string }) =>
              o.status === "pending" ||
              o.status === "confirmed" ||
              o.status === "ready",
          ),
        );
        setOrders(
          rows.map(
            (o: {
              id: string;
              customerName: string | null;
              customerFirstName: string | null;
              quantity: number;
              totalPrice: string;
              pickupAt: string;
              status: ListingOrder["status"];
            }) => ({
              id: o.id,
              customerName: o.customerName ?? o.customerFirstName ?? "Customer",
              quantity: o.quantity,
              totalPrice: o.totalPrice,
              pickupAt: o.pickupAt,
              status: o.status,
            }),
          ),
        );
      }
      if (reviewsRes.ok) {
        const rJson = await reviewsRes.json();
        setReviews(
          (rJson.data ?? []).map(
            (r: {
              id: string;
              rating: number;
              comment: string | null;
              createdAt: string;
            }) => ({
              id: r.id,
              customerName: "Customer",
              rating: r.rating,
              comment: r.comment,
              date: r.createdAt,
            }),
          ),
        );
      }
      if (allDishesRes.ok) {
        const dJson = await allDishesRes.json();
        const inListing = new Set(
          (listing.dishes ?? []).map((d: { dishId: string }) => d.dishId),
        );
        setAvailableDishes(
          (dJson.data ?? [])
            .filter((d: { id: string }) => !inListing.has(d.id))
            .map((d: { id: string; name: string; cuisine: string | null }) => ({
              id: d.id,
              name: d.name,
              cuisine: d.cuisine ?? "",
            })),
        );
      }
    } catch {
      setError("Failed to load listing.");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveOverview = useCallback(
    async (payload: {
      title: string;
      description: string;
      basePrice: string;
      currency: string;
      minOrderQty: number;
      maxOrderQty: string;
      status: ListingStatus;
      tiers: PricingTier[];
      subscriptionEnabled: boolean;
    }) => {
      const body = {
        title: payload.title,
        description: payload.description,
        basePrice: Number(payload.basePrice),
        currency: payload.currency,
        minOrderQty: payload.minOrderQty,
        maxOrderQty: payload.maxOrderQty ? Number(payload.maxOrderQty) : null,
        subscriptionEnabled: payload.subscriptionEnabled,
      };

      const res = await fetch(`/api/business/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;

      if (payload.status === "archived") {
        await fetch(`/api/business/listings/${listingId}/archive`, {
          method: "POST",
        });
      }

      const existing = bundles;
      const nextTiers = payload.tiers;
      const existingIds = new Set(existing.map((b) => b.id));
      const nextIds = new Set(
        nextTiers.filter((t) => !t.id.startsWith("tier-")).map((t) => t.id),
      );

      for (const id of existingIds) {
        if (!nextIds.has(id)) {
          await fetch(`/api/business/listings/${listingId}/bundles/${id}`, {
            method: "DELETE",
          });
        }
      }

      for (const tier of nextTiers) {
        const price = Number(tier.pricePerUnit) * tier.minQty;
        if (!tier.pricePerUnit || Number.isNaN(price)) continue;

        if (tier.id.startsWith("tier-")) {
          await fetch(`/api/business/listings/${listingId}/bundles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: tier.minQty, price }),
          });
          continue;
        }

        const prev = existing.find((b) => b.id === tier.id);
        if (!prev) continue;
        if (prev.quantity !== tier.minQty) {
          await fetch(
            `/api/business/listings/${listingId}/bundles/${tier.id}`,
            { method: "DELETE" },
          );
          await fetch(`/api/business/listings/${listingId}/bundles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: tier.minQty, price }),
          });
        } else {
          await fetch(
            `/api/business/listings/${listingId}/bundles/${tier.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ price }),
            },
          );
        }
      }

      await load();
      return true;
    },
    [bundles, listingId, load],
  );

  const saveSubscriptionTiers = useCallback(
    async (
      tierInputs: {
        interval: SubscriptionInterval;
        price: string;
        enabled: boolean;
      }[],
    ) => {
      for (const input of tierInputs) {
        const existing = subscriptionTiers.find(
          (t) => t.interval === input.interval,
        );
        const priceNum = Number(input.price);

        if (input.enabled) {
          if (!input.price || Number.isNaN(priceNum) || priceNum <= 0) {
            continue;
          }

          if (!existing) {
            await fetch(`/api/business/listings/${listingId}/tiers`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interval: input.interval,
                price: priceNum,
              }),
            });
            continue;
          }

          const updates: { isActive?: boolean; price?: number } = {};
          if (!existing.isActive) updates.isActive = true;
          if (Number(existing.price) !== priceNum) updates.price = priceNum;
          if (Object.keys(updates).length > 0) {
            await fetch(
              `/api/business/listings/${listingId}/tiers/${existing.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
              },
            );
          }
        } else if (existing?.isActive) {
          await fetch(
            `/api/business/listings/${listingId}/tiers/${existing.id}`,
            { method: "DELETE" },
          );
        }
      }

      await load();
    },
    [subscriptionTiers, listingId, load],
  );

  const addDish = useCallback(
    async (dish: AvailableDish) => {
      const res = await fetch(`/api/business/listings/${listingId}/dishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishId: dish.id,
          quantity: 1,
          sortOrder: dishes.length,
        }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [dishes.length, listingId, load],
  );

  const removeDish = useCallback(
    async (dish: ListingDish) => {
      const res = await fetch(
        `/api/business/listings/${listingId}/dishes/${dish.dishId}`,
        { method: "DELETE" },
      );
      if (res.status === 409) return false;
      if (!res.ok) return false;
      await load();
      return true;
    },
    [listingId, load],
  );

  const persistDishOrder = useCallback(
    async (ordered: ListingDish[]) => {
      await Promise.all(
        ordered.map((dish, index) =>
          fetch(`/api/business/listings/${listingId}/dishes/${dish.dishId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: index }),
          }),
        ),
      );
    },
    [listingId],
  );

  const createDeal = useCallback(
    async (deal: {
      type: UiDealType;
      value: string;
      validFrom: string;
      validUntil: string;
      maxUses: string;
    }) => {
      const body: Record<string, unknown> = {
        type: deal.type,
        value: Number(deal.value),
        minimumQty: 1,
        isActive: true,
      };
      if (deal.validFrom) {
        body.validFrom = `${deal.validFrom}T12:00:00.000Z`;
      }
      if (deal.validUntil) {
        body.validUntil = `${deal.validUntil}T23:59:59.000Z`;
      }
      if (deal.maxUses) body.maxUses = Number(deal.maxUses);

      const res = await fetch(
        `/api/business/listings/${listingId}/promotions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return (json.error as string) ?? "Failed to create deal.";
      }
      const json = await res.json();
      setDeals((prev) => [...prev, mapDeal(json.data)]);
      return null;
    },
    [listingId],
  );

  const deleteDeal = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/business/listings/${listingId}/promotions/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) return false;
      setDeals((prev) => prev.filter((d) => d.id !== id));
      return true;
    },
    [listingId],
  );

  const value = useMemo(
    () => ({
      listingId,
      loading,
      error,
      stats,
      listing: listingMeta,
      bundles,
      subscriptionTiers,
      hasActiveOrders,
      dishes,
      setDishes,
      availableDishes,
      deals,
      setDeals,
      orders,
      reviews,
      saveOverview,
      saveSubscriptionTiers,
      addDish,
      removeDish,
      persistDishOrder,
      createDeal,
      deleteDeal,
      reload: load,
    }),
    [
      listingId,
      loading,
      error,
      stats,
      listingMeta,
      bundles,
      subscriptionTiers,
      hasActiveOrders,
      dishes,
      availableDishes,
      deals,
      orders,
      reviews,
      saveOverview,
      saveSubscriptionTiers,
      addDish,
      removeDish,
      persistDishOrder,
      createDeal,
      deleteDeal,
      load,
    ],
  );

  return (
    <ListingDetailContext.Provider value={value}>
      {children}
    </ListingDetailContext.Provider>
  );
}

export { bundleToTier };
