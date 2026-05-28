"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/db";
import { cookApplications } from "@/db/schema";
import { generateSignedValue } from "@/lib/cookie";

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
});

export type ApplicationInput = {
  kitchenName: string;
  kitchenType: string;
  yearsOperating: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  website: string;
  businessPhone: string;
  businessEmail: string;
  contactFirstName: string;
  contactLastName: string;
  role: string;
  phone: string;
  email: string;
};

export async function submitApplication(
  data: ApplicationInput,
): Promise<{ error: string } | undefined> {
  const parsed = schema.safeParse({
    ...data,
    contactRole: data.role,
    contactPhone: data.phone,
    contactEmail: data.email,
  });

  if (!parsed.success) {
    return { error: "Please check all fields and try again." };
  }

  const v = parsed.data;

  try {
    await db.insert(cookApplications).values({
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
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return {
        error:
          "An application with this email already exists. Contact us if you need help.",
      };
    }
    console.error("[submitApplication]", err);
    return { error: "Something went wrong. Please try again." };
  }

  notifyTeam(v.contactEmail, v.kitchenName).catch((e) =>
    console.error("[submitApplication] resend failed:", e),
  );

  const jar = await cookies();
  jar.set("application_submitted", generateSignedValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  redirect("/business/application-confirmation");
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
