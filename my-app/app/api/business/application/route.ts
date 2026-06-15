import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/db";
import { cookApplications, legalAcceptances } from "@/db/schema";
import { generateSignedValue } from "@/lib/cookie";
import { hashIp } from "@/lib/hash";
import { COOK_APPLICATION_DOCS, LEGAL_VERSION } from "@/lib/legal";

const schema = z.object({
  kitchenName: z.string().min(1),
  kitchenType: z.enum([
    "licensed_home",
    "commercial_rented",
    "ghost_kitchen",
    "restaurant_cafe",
    "community_kitchen",
    "other",
  ]),
  yearsOperating: z.string().min(1),
  streetAddress: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.preprocess(
    (v) => String(v).replace(/\s+/g, "").toUpperCase(),
    z.string().regex(/^[A-Z]\d[A-Z]\d[A-Z]\d$/, "Invalid Canadian postal code"),
  ),
  website: z.string().optional(),
  businessPhone: z.string().transform((v) => v.replace(/\D/g, "")),
  businessEmail: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  contactFirstName: z.string().min(1),
  contactLastName: z.string().min(1),
  contactRole: z.string().min(1),
  contactPhone: z.string().transform((v) => v.replace(/\D/g, "")),
  contactEmail: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  // Clickwrap: the application form blocks submit until this is true.
  acceptedTerms: z.literal(true),
});

export async function POST(req: Request) {
  const body = await req.json();

  const parsed = schema.safeParse({
    ...body,
    contactRole: body.role,
    contactPhone: body.phone,
    contactEmail: body.email,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check all fields and try again." },
      { status: 400 },
    );
  }

  const v = parsed.data;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    const [application] = await db
      .insert(cookApplications)
      .values({
        kitchenName: v.kitchenName,
        kitchenType: v.kitchenType,
        yearsOperating: v.yearsOperating,
        streetAddress: v.streetAddress,
        city: v.city,
        province: v.province,
        postalCode: v.postalCode,
        website: v.website,
        businessPhone: v.businessPhone,
        businessEmail: v.businessEmail,
        contactFirstName: v.contactFirstName,
        contactLastName: v.contactLastName,
        contactRole: v.contactRole,
        contactPhone: v.contactPhone,
        contactEmail: v.contactEmail,
      })
      .returning({ id: cookApplications.id });

    // Record the clickwrap acceptance against the application (no user account
    // exists yet at this stage). Best-effort — never block the application.
    try {
      await db.insert(legalAcceptances).values({
        applicationId: application.id,
        context: "cook_application",
        version: LEGAL_VERSION,
        documents: [...COOK_APPLICATION_DOCS],
        ipHash: ip === "unknown" ? null : hashIp(ip),
        userAgent: req.headers.get("user-agent"),
      });
    } catch (err) {
      console.error("[application] legal acceptance record failed:", err);
    }
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        {
          error:
            "An application with this email already exists. Contact us if you need help.",
        },
        { status: 409 },
      );
    }
    console.error("[application]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  notifyTeam(v.contactEmail, v.kitchenName).catch((e) =>
    console.error("[application] team notify failed:", e),
  );
  confirmCook(v.contactEmail, v.contactFirstName, v.kitchenName).catch((e) =>
    console.error("[application] cook confirm failed:", e),
  );

  const res = NextResponse.json({
    redirect: "/business/application-confirmation",
  });
  res.cookies.set("application_submitted", generateSignedValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}

async function confirmCook(to: string, firstName: string, kitchenName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
    to,
    subject: `We received your application, ${firstName}`,
    text: [
      `Hi ${firstName},`,
      "",
      `Thank you for applying to 7eats with ${kitchenName}. We're excited to learn more about what you're cooking.`,
      "",
      "We review every application personally. A member of our team will reach out within 2 business days by phone. Not an automated call, a real conversation.",
      "",
      "In the meantime, feel free to reply to this email if you have any questions.",
      "",
      "The 7eats team, Toronto",
    ].join("\n"),
  });
}

async function notifyTeam(contactEmail: string, kitchenName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@7eats.ca",
    to: process.env.RESEND_TEAM_EMAIL ?? "",
    subject: `New cook application: ${kitchenName}`,
    text: `New application from ${contactEmail} for "${kitchenName}". Review in the admin dashboard.`,
  });
}
