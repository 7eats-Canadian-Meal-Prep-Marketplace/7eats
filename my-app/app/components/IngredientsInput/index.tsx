"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  dedupeAgainst,
  parsePastedNames,
} from "@/lib/dishes/parse-pasted-ingredients";
import styles from "./IngredientsInput.module.css";

export type IngredientRow = { id: string; name: string };

/**
 * Shared ingredient list editor for dish creation and editing. Supports
 * pasting a comma- or newline-separated list (e.g. from a recipe) to add
 * several ingredients at once, deduping against names already on the list.
 */
export default function IngredientsInput({
  ingredients,
  onChange,
  idPrefix = "ing",
  placeholder = "e.g. Tomato paste",
  emptyState,
}: {
  ingredients: IngredientRow[];
  onChange: (next: IngredientRow[]) => void;
  idPrefix?: string;
  placeholder?: string;
  emptyState?: React.ReactNode;
}) {
  const [blankGuard, setBlankGuard] = useState(false);

  function addRow() {
    if (ingredients.some((i) => !i.name.trim())) {
      setBlankGuard(true);
      toast.error("Fill in the current ingredient before adding another.");
      return;
    }
    onChange([...ingredients, { id: `${idPrefix}-${Date.now()}`, name: "" }]);
  }

  function removeRow(id: string) {
    onChange(ingredients.filter((i) => i.id !== id));
  }

  function updateRow(id: string, value: string) {
    onChange(ingredients.map((i) => (i.id === id ? { ...i, name: value } : i)));
    if (value.trim()) setBlankGuard(false);
  }

  function handlePaste(id: string, e: React.ClipboardEvent<HTMLInputElement>) {
    const tokens = parsePastedNames(e.clipboardData.getData("text"));
    if (tokens.length <= 1) return;
    e.preventDefault();

    const otherNames = ingredients
      .filter((i) => i.id !== id)
      .map((i) => i.name);
    const { added, duplicateCount } = dedupeAgainst(otherNames, tokens);

    if (added.length === 0) {
      toast.error("Those ingredients are already on the list.");
      return;
    }

    const [first, ...rest] = added;
    const index = ingredients.findIndex((i) => i.id === id);
    const next = ingredients.map((i) =>
      i.id === id ? { ...i, name: first } : i,
    );
    next.splice(
      index + 1,
      0,
      ...rest.map((name, i) => ({
        id: `${idPrefix}-${Date.now()}-${i}`,
        name,
      })),
    );
    onChange(next);
    setBlankGuard(false);

    const suffix =
      duplicateCount > 0
        ? ` (${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""} skipped)`
        : "";
    toast.success(
      `Added ${added.length} ingredient${added.length > 1 ? "s" : ""}${suffix}`,
    );
  }

  return (
    <div className={styles.wrap}>
      {ingredients.length > 0 ? (
        <div className={styles.list}>
          {ingredients.map((ing) => (
            <div key={ing.id} className={styles.row}>
              <input
                type="text"
                aria-label="Ingredient name"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={blankGuard && !ing.name.trim() ? true : undefined}
                className={`${styles.input} ${
                  blankGuard && !ing.name.trim() ? styles.inputError : ""
                }`}
                value={ing.name}
                placeholder={placeholder}
                onChange={(e) => updateRow(ing.id, e.target.value)}
                onPaste={(e) => handlePaste(ing.id, e)}
              />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeRow(ing.id)}
                aria-label="Remove ingredient"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        (emptyState ?? (
          <p className={styles.emptyNote}>Add at least one ingredient.</p>
        ))
      )}

      <button type="button" className={styles.addBtn} onClick={addRow}>
        <Plus size={13} />
        Add ingredient
      </button>
      <p className={styles.pasteHint}>
        Tip: paste a comma-separated list (e.g. "Tomato, Onion, Garlic") to add
        several at once.
      </p>
    </div>
  );
}
