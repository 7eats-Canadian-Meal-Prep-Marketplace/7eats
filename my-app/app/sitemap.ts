import type { MetadataRoute } from "next";

const BASE = "https://www.7eats.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${BASE}/public/waitlist`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE}/business/home`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/app/browse`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE}/business/application`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE}/public/team`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/cook-terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/food-safety`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/refund-policy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/community-guidelines`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
