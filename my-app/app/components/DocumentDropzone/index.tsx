"use client";

import { FileText, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./DocumentDropzone.module.css";

const DEFAULT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

function buildAllowedLabel(accept: string): string {
  return Array.from(
    new Set(
      accept
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean)
        .map((t) => {
          if (t === "jpeg") return "JPG";
          if (t === "jpg") return "JPG";
          if (t === "png") return "PNG";
          if (t === "pdf" || t === "application/pdf") return "PDF";
          if (t === "image/jpeg") return "JPG";
          if (t === "image/png") return "PNG";
          return t.toUpperCase();
        }),
    ),
  ).join(" / ");
}

function matchesAccept(file: File, accept: string): boolean {
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

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export default function DocumentDropzone({
  id,
  accept = DEFAULT_ACCEPT,
  maxBytes = 10 * 1024 * 1024,
  fileName,
  note = "PDF or image - max 10 MB",
  onFile,
}: {
  id: string;
  accept?: string;
  maxBytes?: number;
  fileName?: string;
  note?: string;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectReason, setRejectReason] = useState<"type" | "size" | null>(
    null,
  );

  const allowedLabel = buildAllowedLabel(accept);
  const hasFile = Boolean(fileName);

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

  function flagRejected(reason: "type" | "size") {
    setRejectReason(reason);
    setRejected(true);
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => {
      setRejected(false);
      setRejectReason(null);
    }, 3500);
  }

  function selectFile(file: File | null) {
    if (!file) return;
    if (!matchesAccept(file, accept)) {
      flagRejected("type");
      return;
    }
    if (file.size > maxBytes) {
      flagRejected("size");
      return;
    }
    setRejected(false);
    setRejectReason(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(isImage(file) ? URL.createObjectURL(file) : null);
    onFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  }

  const errorMessage =
    rejectReason === "size"
      ? `File is too large - max ${Math.round(maxBytes / (1024 * 1024))} MB.`
      : `Unsupported file - use ${allowedLabel}.`;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.zone} ${dragging ? styles.dragging : ""} ${hasFile && !rejected ? styles.hasFile : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {hasFile && preview && !rejected ? (
          // biome-ignore lint/performance/noImgElement: blob preview
          <img src={preview} alt="" className={styles.preview} />
        ) : hasFile && !rejected ? (
          <span className={styles.icon}>
            <FileText size={28} strokeWidth={1.5} />
          </span>
        ) : (
          <span className={styles.icon}>
            <Upload size={28} strokeWidth={1.5} />
          </span>
        )}

        {hasFile && !rejected && (
          <>
            <p className={styles.fileName}>{fileName}</p>
            <p className={styles.sub}>Click or drop to replace</p>
            <span className={styles.overlay}>
              <Upload size={16} strokeWidth={2} />
              <span>Change</span>
            </span>
          </>
        )}

        {!hasFile && !rejected && (
          <>
            <p className={styles.fileName}>
              Drag &amp; drop or click to upload
            </p>
            <p className={styles.sub}>{note}</p>
          </>
        )}

        {rejected && (
          <span className={styles.errorOverlay}>
            <TriangleAlert size={26} strokeWidth={2} />
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

      {rejected ? (
        <p className={styles.errorMsg} role="alert">
          {errorMessage}
        </p>
      ) : (
        !hasFile && (
          <p className={styles.instruction}>
            <Upload size={13} strokeWidth={2} />
            Accepted: {allowedLabel}
          </p>
        )
      )}
    </div>
  );
}
