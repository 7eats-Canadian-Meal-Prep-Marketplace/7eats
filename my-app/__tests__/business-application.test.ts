import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { insert: vi.fn() } }));
vi.mock("@/db/schema", () => ({ cookApplications: {} }));
vi.mock("@/lib/cookie", () => ({
  generateSignedValue: vi.fn(() => "signed-cookie-value"),
}));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({}) },
  })),
}));

import { POST } from "@/app/api/business/application/route";
import { db } from "@/db";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/business/application", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validBody = {
  kitchenName: "Mama's Kitchen",
  kitchenType: "licensed_home",
  yearsOperating: "3",
  streetAddress: "123 Main St",
  city: "Toronto",
  province: "ON",
  postalCode: "M5V 3L9",
  businessPhone: "(416) 555-0100",
  businessEmail: "info@mamas.ca",
  contactFirstName: "Jane",
  contactLastName: "Doe",
  role: "Owner",
  phone: "(416) 555-0101",
  email: "jane@mamas.ca",
};

let valuesSpy: ReturnType<typeof vi.fn>;

describe("POST /api/business/application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as never);
  });

  it("returns 200 with redirect on a valid body", async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.redirect).toBe("/business/application-confirmation");
  });

  it("sets application_submitted cookie on success", async () => {
    const res = await POST(makeRequest(validBody));

    const cookies = res.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies[0]).toContain("application_submitted=");
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[0]).toContain("SameSite=lax");
  });

  it("normalizes businessEmail and contactEmail to lowercase", async () => {
    const body = {
      ...validBody,
      businessEmail: "INFO@Mamas.CA",
      email: "JANE@Mamas.CA",
    };

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(200);

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        businessEmail: "info@mamas.ca",
        contactEmail: "jane@mamas.ca",
      }),
    );
  });

  it("normalizes postal code (strips spaces and uppercases)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, postalCode: "m5v 3l9" }),
    );
    expect(res.status).toBe(200);

    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: "M5V3L9" }),
    );
  });

  it("returns 400 for an invalid postal code", async () => {
    const res = await POST(makeRequest({ ...validBody, postalCode: "12345" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please check all fields and try again.");
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid kitchenType", async () => {
    const res = await POST(
      makeRequest({ ...validBody, kitchenType: "food_truck" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please check all fields and try again.");
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when a required field is missing (kitchenName empty)", async () => {
    const res = await POST(makeRequest({ ...validBody, kitchenName: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please check all fields and try again.");
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it("returns 409 when DB reports a unique violation (code 23505)", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    valuesSpy.mockRejectedValue(uniqueViolation);

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("An application with this email");
  });

  it("returns 500 on an unexpected DB error", async () => {
    valuesSpy.mockRejectedValue(new Error("connection reset"));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("returns 400 for an invalid email format in contactEmail", async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: "not-an-email" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Please check all fields and try again.");
    expect(valuesSpy).not.toHaveBeenCalled();
  });
});
