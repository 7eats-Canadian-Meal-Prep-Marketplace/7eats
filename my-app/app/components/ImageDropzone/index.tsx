"use client";

import { ImagePlus, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./ImageDropzone.module.css";

export default function ImageDropzone({
  id,
  variant,
  existingUrl,
  accept = ".jpg,.jpeg,.png",
  note,
  alt = "",
  onFile,
}: {
  id: string;
  variant: "avatar" | "banner";
  existingUrl: string | null;
  accept?: string;
  note?: string;
  alt?: string;
  /** Called with the chosen file, or null when cleared/invalid. */
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);
  const src = preview ?? existingUrl;

  // Short, readable list of allowed types, e.g. "JPG / PNG".
  const allowedLabel = Array.from(
    new Set(
      accept
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean)
        .map((e) => (e === "jpeg" ? "jpg" : e).toUpperCase()),
    ),
  ).join(" / ");

  // Revoke the previous object URL when the preview changes or unmounts so
  // picking several files in a row doesn't leak blob URLs.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
    };
  }, []);

  function flagRejected() {
    setRejected(true);
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejected(false), 3500);
  }

  function matchesAccept(file: File): boolean {
    const tokens = accept
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length === 0) return true;
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return tokens.some((tok) =>
      tok.startsWith(".") ? name.endsWith(tok) : type === tok,
    );
  }

  // Single entry point for both drag-drop and the file picker so wrong types
  // get the same in-place feedback instead of slipping through to the server.
  function selectFile(file: File | null) {
    if (!file) return;
    if (!matchesAccept(file)) {
      flagRejected();
      return;
    }
    setRejected(false);
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.zone} ${styles[variant]} ${dragging ? styles.dragging : ""} ${src ? styles.hasImage : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {src ? (
          // biome-ignore lint/performance/noImgElement: blob/object-URL preview, next/image adds no value here
          <img src={src} alt={alt} className={styles.img} />
        ) : (
          <ImagePlus
            className={styles.icon}
            size={variant === "avatar" ? 22 : 28}
            strokeWidth={1.75}
          />
        )}
        {src && !rejected && (
          <span className={styles.overlay}>
            <Upload size={16} strokeWidth={2} />
            <span>Change</span>
          </span>
        )}
        {rejected && (
          <span className={styles.errorOverlay}>
            <TriangleAlert
              size={variant === "avatar" ? 22 : 26}
              strokeWidth={2}
            />
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
      />

      <div className={styles.meta}>
        {rejected ? (
          <p className={styles.errorMsg} role="alert">
            Unsupported file. Use a {allowedLabel} image.
          </p>
        ) : (
          <>
            <p className={styles.instruction}>
              <Upload size={13} strokeWidth={2} />
              Drag &amp; drop or click to upload
            </p>
            {note && <p className={styles.note}>{note}</p>}
          </>
        )}
      </div>
    </div>
  );
}
