import { sendMail } from "@/lib/email";
import {
  contactParagraph,
  contactTextLine,
  htmlEmail,
  orderDetailsTable,
  paragraph,
} from "@/lib/emails/base";

const COLOR = {
  red: "#d64045",
  grey300: "#dadada",
  grey700: "#6b6b6b",
  ink: "#0f0f0f",
  white: "#ffffff",
} as const;

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function starRatingHtml(rating: number): string {
  const filled = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return `<span style="color:${COLOR.red};letter-spacing:0.06em;font-size:18px;line-height:1;">${filled}</span><span style="color:${COLOR.grey300};letter-spacing:0.06em;font-size:18px;line-height:1;">${empty}</span>`;
}

function starRatingText(rating: number): string {
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)`;
}

function commentBlock(comment: string): string {
  const safe = comment
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
<tr>
<td style="padding:16px 18px;background-color:${COLOR.white};border:1px solid #ececec;border-left:3px solid ${COLOR.red};border-radius:12px;">
<p style="margin:0 0 6px;font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR.grey700};">What they said</p>
<p style="margin:0;font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${COLOR.ink};white-space:pre-wrap;">${safe}</p>
</td>
</tr>
</table>`;
}

export type NewReviewEmailData = {
  customerName: string;
  orderSummary: string;
  rating: number;
  comment: string | null;
};

export async function sendNewReviewEmailToCook(
  cook: { email: string; firstName: string | null },
  review: NewReviewEmailData,
): Promise<void> {
  try {
    const subject = `New ${review.rating}-star review from ${review.customerName}`;
    const stars = starRatingHtml(review.rating);
    const html = htmlEmail({
      title: subject,
      preheader: `${review.customerName} left a ${review.rating}-star review for ${review.orderSummary}.`,
      bodyHtml:
        paragraph(greeting(cook.firstName)) +
        paragraph(
          `<strong>${review.customerName}</strong> left a review for <strong>${review.orderSummary}</strong>.`,
        ) +
        `<p style="margin:0 0 20px;font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${COLOR.ink};">${stars}</p>` +
        orderDetailsTable([
          { label: "Customer", value: review.customerName },
          { label: "Order", value: review.orderSummary },
          { label: "Rating", value: `${review.rating} out of 5` },
        ]) +
        (review.comment ? commentBlock(review.comment) : "") +
        paragraph("You can see all your reviews on your dashboard.") +
        contactParagraph(),
      ctaLabel: "View dashboard",
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/business/dashboard`,
    });
    const text = [
      greeting(cook.firstName),
      "",
      `${review.customerName} left a review for ${review.orderSummary}.`,
      "",
      `Rating: ${starRatingText(review.rating)}`,
      ...(review.comment ? ["", `Comment: ${review.comment}`] : []),
      "",
      "View your dashboard:",
      `${process.env.NEXT_PUBLIC_APP_URL}/business/dashboard`,
      "",
      contactTextLine(),
    ].join("\n");
    await sendMail({ to: cook.email, subject, text, html });
  } catch (err) {
    console.error("[email/new-review-cook]", err);
  }
}
