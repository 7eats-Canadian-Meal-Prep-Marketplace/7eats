export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () =>
      reject(new Error("Could not load the image for cropping.")),
    );
    img.src = src;
  });
}

/**
 * Crops `src` to the given pixel rectangle (in the image's natural pixels, as
 * reported by react-easy-crop) and returns a JPEG `File`. Output is capped at
 * `maxWidth` px wide to keep uploads comfortably under the cover-photo size
 * limit while staying sharp.
 */
export async function getCroppedImageFile(
  src: string,
  area: CropAreaPixels,
  fileName: string,
  maxWidth = 1600,
): Promise<File> {
  const image = await loadImage(src);

  const scale = area.width > maxWidth ? maxWidth / area.width : 1;
  const outWidth = Math.max(1, Math.round(area.width * scale));
  const outHeight = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outWidth,
    outHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Could not process the image. Please try again.");

  const baseName = fileName.replace(/\.[^./\\]+$/, "") || "cover";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}
