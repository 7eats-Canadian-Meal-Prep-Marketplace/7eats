export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

/** Allowed dish cover / gallery photo MIME types (must match upload routes). */
export const DISH_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type DishPhotoMime = (typeof DISH_PHOTO_MIME_TYPES)[number];

export const DISH_PHOTO_ACCEPT = DISH_PHOTO_MIME_TYPES.join(",");

export const DISH_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedDishPhotoMime(mime: string): mime is DishPhotoMime {
  return (DISH_PHOTO_MIME_TYPES as readonly string[]).includes(mime);
}

export function validateDishPhotoFile(file: File): string | null {
  if (!isAllowedDishPhotoMime(file.type)) {
    return "Photo must be JPG, PNG, or WebP.";
  }
  if (file.size > DISH_PHOTO_MAX_BYTES) {
    return "Photo must be smaller than 10 MB.";
  }
  if (file.size === 0) {
    return "Photo file is empty.";
  }
  return null;
}

export function sniffFileType(buf: Buffer): SniffedType | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF"<4-byte size>"WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return null;
}
