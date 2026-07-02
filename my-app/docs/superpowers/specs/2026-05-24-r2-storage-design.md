# Cloudflare R2 Storage Design

**Date:** 2026-05-24
**Branch:** setup-cloudflare-r2
**Status:** Approved

---

## Overview

Configure Cloudflare R2 as the object storage layer for 7eats/homecook. Four buckets covering certifications, listing photos, avatars, and a temp staging area. Accessed via the S3-compatible API using `@aws-sdk/client-s3`. The storage layer lives in `lib/storage/` as per-bucket modules sharing a single client.

---

## Buckets

| Bucket | Access | Purpose | Database column |
|--------|--------|---------|----------------|
| `homecook-certs-private` | Private, signed URLs only | Cook certification documents | `cook_certifications.file_url` |
| `homecook-listings-public` | Public CDN | Listing photos | `listing_photos.url` |
| `homecook-avatars-public` | Public CDN | User/cook profile photos | `users.avatar_url` |
| `homecook-uploads-temp` | Private, internal only | Temp staging before validation | — |

**Bucket creation (Wrangler CLI):**
```bash
wrangler r2 bucket create homecook-certs-private
wrangler r2 bucket create homecook-listings-public
wrangler r2 bucket create homecook-avatars-public
wrangler r2 bucket create homecook-uploads-temp
```

**Manual dashboard step:** Set a 24h lifecycle TTL on `homecook-uploads-temp` — Wrangler does not yet support R2 lifecycle rules.

---

## File Structure

```
lib/storage/
  client.ts     — S3Client singleton; validates env vars at import time
  buckets.ts    — bucket name constants + per-bucket config (access type, CDN base URL, TTL)
  certs.ts      — uploadCert(), getSignedCertUrl()
  listings.ts   — uploadListingPhoto(), getListingPhotoUrl(), deleteListingPhoto()
  avatars.ts    — uploadAvatar(), getAvatarUrl(), deleteAvatar()
  temp.ts       — uploadToTemp(), moveFromTemp(), deleteTemp()
  index.ts      — barrel re-export of all public functions and bucket constants
```

---

## Architecture

### `client.ts`
- Instantiates a single `S3Client` pointed at `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- Validates all five required env vars at module load time; throws a descriptive `Error` naming the missing var if any are absent
- Exported as a singleton shared by all bucket modules

### `buckets.ts`
- Exports typed constants for all four bucket names — the single source of truth, no bucket name strings elsewhere
- Exports a per-bucket config map: `{ access: 'public' | 'private', cdnBaseUrl?: string, signedUrlTtl?: number }`

### Per-bucket modules
Each module imports the shared client and its bucket constant. Functions are scoped to only the operations that make sense for that bucket:

- **`certs.ts`** — private only; no public URL function exists, preventing accidental public exposure
- **`listings.ts` / `avatars.ts`** — public only; `getXxxUrl()` is a pure CDN URL string construction (no R2 API call needed)
- **`temp.ts`** — internal staging; `moveFromTemp()` does CopyObject → DeleteObject (copy-then-delete)

---

## Operations

### `certs.ts`
```ts
uploadCert(cookId: string, fileName: string, body: Buffer, contentType: string): Promise<string>
// returns storage key

getSignedCertUrl(key: string, expiresIn?: number): Promise<string>
// expiresIn defaults to 900s (15 min), max 3600s (60 min)
```

### `listings.ts`
```ts
uploadListingPhoto(listingId: string, fileName: string, body: Buffer, contentType: string): Promise<string>
// returns stable CDN URL (stored in DB)

getListingPhotoUrl(key: string): string
// pure CDN URL construction, no API call

deleteListingPhoto(key: string): Promise<void>
```

### `avatars.ts`
```ts
uploadAvatar(userId: string, fileName: string, body: Buffer, contentType: string): Promise<string>
// returns stable CDN URL (stored in DB)

getAvatarUrl(key: string): string

deleteAvatar(key: string): Promise<void>
```

### `temp.ts`
```ts
uploadToTemp(key: string, body: Buffer, contentType: string): Promise<void>

moveFromTemp(key: string, destBucket: 'homecook-certs-private' | 'homecook-listings-public' | 'homecook-avatars-public', destKey: string): Promise<void>
// CopyObject to destination, then DeleteObject from temp

deleteTemp(key: string): Promise<void>
// explicit cleanup on validation failure
```

---

## Environment Variables

All five are required. `client.ts` throws at startup if any are missing.

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID — used to build the S3 endpoint URL |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_PUBLIC_BUCKET_URL_LISTINGS` | CDN public base URL for `homecook-listings-public` |
| `R2_PUBLIC_BUCKET_URL_AVATARS` | CDN public base URL for `homecook-avatars-public` |

The CDN base URLs (not R2 storage URLs) are what get stored in database columns. This decouples stored URLs from the storage provider.

---

## Temp Upload Flow

```
Client → POST /api/upload
  → uploadToTemp(key, body)
  → validate (file type, size, content checks)
  → pass: moveFromTemp(key, destBucket, destKey) → return final URL
  → fail: deleteTemp(key) → return error
```

Orphaned temp objects (e.g. server crash mid-flow) are automatically cleaned up by the 24h lifecycle TTL on the bucket.

---

## Error Handling

- SDK errors from `@aws-sdk/client-s3` propagate as-is to callers (API routes). They carry useful codes (`NoSuchKey`, `AccessDenied`) that callers translate into HTTP responses.
- No silent error swallowing, no generic wrappers that lose error context.
- `client.ts` env validation throws a plain `Error` at startup with the missing variable name.

---

## Testing

- Unit tests in `__tests__/storage/` using Vitest
- `@aws-sdk/client-s3` mocked with `vi.mock` — no live R2 calls in unit tests
- Coverage per module:
  - Correct bucket targeting (no cross-bucket calls)
  - Key construction format
  - Signed URL expiry parameter passed correctly
  - CDN URL construction format
  - `temp.ts`: copy-then-delete sequence, cleanup on failure
  - `client.ts`: throws with clear message for each missing env var

---

## Dependencies

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
