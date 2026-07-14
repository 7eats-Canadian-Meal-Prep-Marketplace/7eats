import { describe, expect, it } from "vitest";
import {
  isDishDraft,
  isDishOrderable,
  isDishPaused,
  normalizeDishStatus,
} from "@/lib/dishes/status-core";

describe("normalizeDishStatus", () => {
  it("keeps draft distinct from active/inactive", () => {
    expect(normalizeDishStatus("draft")).toBe("draft");
    expect(normalizeDishStatus("active")).toBe("active");
    expect(normalizeDishStatus("inactive")).toBe("inactive");
    expect(normalizeDishStatus("archived")).toBe("inactive");
  });
});

describe("dish status helpers", () => {
  it("treats draft as not paused and not orderable", () => {
    expect(isDishDraft("draft")).toBe(true);
    expect(isDishPaused("draft")).toBe(false);
    expect(isDishOrderable("draft")).toBe(false);
  });

  it("treats active as orderable", () => {
    expect(isDishOrderable("active")).toBe(true);
    expect(isDishPaused("active")).toBe(false);
    expect(isDishDraft("active")).toBe(false);
  });

  it("treats inactive/archived as paused and not orderable", () => {
    expect(isDishPaused("inactive")).toBe(true);
    expect(isDishPaused("archived")).toBe(true);
    expect(isDishOrderable("inactive")).toBe(false);
    expect(isDishDraft("inactive")).toBe(false);
  });

  it("does not treat draft as archived/paused for listing actions", () => {
    // Pause/Activate buttons must not fire for drafts — only Delete / Publish.
    expect(isDishPaused("draft")).toBe(false);
    expect(isDishDraft("draft")).toBe(true);
  });
});
