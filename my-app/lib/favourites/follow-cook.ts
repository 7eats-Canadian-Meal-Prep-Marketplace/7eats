export async function fetchCookFollowState(
  cookId: string,
): Promise<boolean | null> {
  const res = await fetch(`/api/favourites/cooks/${cookId}`, {
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) return false;
  const json = (await res.json()) as { data?: { following?: boolean } };
  return Boolean(json.data?.following);
}

export async function followCook(
  cookId: string,
): Promise<"ok" | "auth" | "error"> {
  const res = await fetch("/api/favourites/cooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cookId }),
  });
  if (res.status === 401) return "auth";
  if (res.ok || res.status === 409) return "ok";
  return "error";
}

export async function unfollowCook(
  cookId: string,
): Promise<"ok" | "auth" | "error"> {
  const res = await fetch(`/api/favourites/cooks/${cookId}`, {
    method: "DELETE",
  });
  if (res.status === 401) return "auth";
  if (res.ok) return "ok";
  return "error";
}
