"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { type CropAreaPixels, getCroppedImageFile } from "@/lib/crop-image";
import styles from "./_cover-crop-modal.module.css";

export function CoverCropModal({
  src,
  fileName,
  onCancel,
  onApply,
}: {
  src: string;
  fileName: string;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<CropAreaPixels | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  async function handleApply() {
    if (!areaPixels || busy) return;
    setBusy(true);
    setError("");
    try {
      const file = await getCroppedImageFile(src, areaPixels, fileName);
      await onApply(file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not crop the image.",
      );
      setBusy(false);
    }
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss; Esc handled above
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
    <div
      className={styles.backdrop}
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current && !busy) onCancel();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Adjust cover photo"
      >
        <div className={styles.head}>
          <h2 className={styles.title}>Adjust cover photo</h2>
          <p className={styles.sub}>
            Drag to reposition, zoom to frame the part you want to show.
          </p>
        </div>

        <div className={styles.cropArea}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={16 / 10}
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className={styles.controls}>
          <span className={styles.zoomLabel}>Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={styles.zoomSlider}
            aria-label="Zoom"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={busy || !areaPixels}
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
