// 7eats transactional email system.
//
// Every HTML email in the app is composed from the helpers below so the look
// stays consistent and on-brand. The visual language mirrors the marketing
// site (app/globals.css): Plus Jakarta Sans, a white card on a soft grey
// canvas, the brand red (#d64045) as the single accent, hairline dividers,
// pill buttons, and generous editorial spacing.
//
// Everything is table-based with inline styles so it renders the same across
// Gmail, Apple Mail, Outlook, and mobile clients. Web fonts are loaded for the
// clients that support them and degrade to a clean sans-serif everywhere else.

// Font names are wrapped in SINGLE quotes on purpose: these strings land inside
// double-quoted inline `style="..."` attributes, so double-quoted font names
// (e.g. "Plus Jakarta Sans") would terminate the attribute early and silently
// drop every declaration after font-family. Single quotes are valid there.
const FONT_STACK =
  "'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

// Brand palette — kept in lockstep with the CSS custom properties in
// app/globals.css so emails and the site never drift apart.
const COLOR = {
  red: "#d64045",
  redDeep: "#b6353a",
  redTint: "#fbeced",
  ink: "#0f0f0f",
  grey700: "#6b6b6b",
  grey500: "#9a9a9a",
  grey300: "#dadada",
  grey200: "#ececec",
  grey100: "#f4f4f4",
  white: "#ffffff",
} as const;

export const CONTACT_EMAIL = "team@7eats.ca";
export const NOREPLY_FROM = "noreply@7eats.ca";

/** Resend From header display names — same mailbox, different inbox label. */
export type EmailSenderProfile = "noreply" | "team";

const SENDER_DISPLAY_NAMES: Record<EmailSenderProfile, string> = {
  noreply: "noreply",
  team: "7eats Team",
};

/** Builds a Resend-compatible From value, e.g. `noreply <noreply@7eats.ca>`. */
export function formatEmailFrom(
  profile: EmailSenderProfile = "noreply",
  email = process.env.RESEND_FROM_EMAIL ?? NOREPLY_FROM,
): string {
  return `${SENDER_DISPLAY_NAMES[profile]} <${email}>`;
}

// The brand wordmark, served as a PNG (email clients don't render SVG). Built
// from public/7eats-logo.svg via scripts/make-email-logo.mjs; intrinsic 113x64.
// Email clients must fetch images from the public internet, so local app URLs
// fall back to the production domain.
const DEFAULT_EMAIL_ASSET_ORIGIN = "https://www.7eats.ca";

function emailAssetOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredOrigin) return DEFAULT_EMAIL_ASSET_ORIGIN;

  try {
    const url = new URL(configuredOrigin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return DEFAULT_EMAIL_ASSET_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_EMAIL_ASSET_ORIGIN;
  }
}

const LOGO_URL = `${emailAssetOrigin()}/7eats-logo-email.png`;

// Minimal HTML escaping for untrusted, plain-text values (names, dish titles,
// cook-entered addresses) that get dropped into a markup context such as the
// headline or a details-table value.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function contactParagraph(): string {
  return paragraph(
    `Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:${COLOR.red};font-weight:600;text-decoration:none;">${CONTACT_EMAIL}</a>.`,
  );
}

export function contactTextLine(): string {
  return `Questions? Email us at ${CONTACT_EMAIL}.`;
}

type HtmlEmailOptions = {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function htmlEmail({
  title,
  preheader,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: HtmlEmailOptions): string {
  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
<tr>
<td align="left" style="border-radius:999px;background-color:${COLOR.red};">
<a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${COLOR.white};text-decoration:none;border-radius:999px;letter-spacing:-0.01em;">${escapeHtml(ctaLabel)}&nbsp;&rarr;</a>
</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
<tr>
<td style="padding:16px 18px;background-color:${COLOR.white};border:1px solid ${COLOR.grey200};border-left:3px solid ${COLOR.red};border-radius:12px;">
<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${COLOR.grey700};">Button not working? Copy and paste this link:</p>
<a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="font-family:${FONT_STACK};font-size:12px;line-height:1.55;color:${COLOR.red};word-break:break-all;text-decoration:underline;text-underline-offset:2px;">${ctaUrl}</a>
</td>
</tr>
</table>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
a { text-decoration: none; }
@media (max-width: 620px) {
  .email-card { border-radius: 0 !important; }
  .email-pad { padding: 32px 24px !important; }
  .email-head-pad { padding: 24px 24px 20px !important; }
  .email-foot-pad { padding: 28px 24px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.grey100};-webkit-font-smoothing:antialiased;">
<div style="display:none;overflow:hidden;line-height:1px;max-height:0;max-width:0;opacity:0;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.grey100};">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:600px;width:100%;background-color:${COLOR.white};border:1px solid ${COLOR.grey200};border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(15,15,15,0.04), 0 12px 32px rgba(15,15,15,0.05);">
<tr>
<td class="email-head-pad" style="padding:26px 40px 22px;border-bottom:1px solid ${COLOR.grey200};">
<img src="${LOGO_URL}" width="56" height="32" alt="7eats" style="display:block;width:56px;height:32px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
</td>
</tr>
<tr>
<td class="email-pad" style="padding:40px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLOR.ink};">
<h1 style="margin:0 0 22px;font-family:${FONT_STACK};font-size:26px;font-weight:700;letter-spacing:-0.025em;line-height:1.15;color:${COLOR.ink};">${escapeHtml(title)}</h1>
${bodyHtml}
${cta}
</td>
</tr>
<tr>
<td class="email-foot-pad" style="padding:28px 40px;border-top:1px solid ${COLOR.grey200};background-color:${COLOR.white};">
<img src="${LOGO_URL}" width="39" height="22" alt="7eats" style="display:block;width:39px;height:22px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;margin:0 0 8px;" />
<p style="margin:0;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:${COLOR.grey500};">Homemade food from cooks near you &middot; Toronto<br />&copy; 7eats &middot; <a href="mailto:${CONTACT_EMAIL}" style="color:${COLOR.grey500};text-decoration:underline;">${CONTACT_EMAIL}</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function orderDetailsTable(
  rows: Array<{ label: string; value: string }>,
): string {
  const cells = rows
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${COLOR.grey200};`;
      return `<tr>
<td style="${border}padding:13px 18px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.grey700};">${r.label}</td>
<td style="${border}padding:13px 18px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.ink};font-weight:600;text-align:right;">${r.value}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;border:1px solid ${COLOR.grey200};border-radius:14px;overflow:hidden;background-color:${COLOR.white};">${cells}</table>`;
}

type OrderSummaryItem = {
  name: string;
  quantity: number;
  lineTotal?: string | number | null;
  discountAmount?: string | number | null;
};

/**
 * Itemised order summary — the email counterpart of the on-site order summary
 * card. Renders one row per dish (qty · name · line total) and, when
 * `showTotals` is on, a subtotal / delivery / tax / total breakdown beneath a
 * hairline divider. Table-based with inline styles so it renders everywhere.
 */
export function orderSummaryTable(opts: {
  items: OrderSummaryItem[];
  deliveryFee?: number;
  /** Platform-funded discount applied to the order. Rendered as a −$ line. */
  platformDiscount?: number;
  tax?: number;
  taxLabel?: string | null;
  total?: string | number | null;
  currency?: string | null;
  showTotals?: boolean;
}): string {
  const showTotals = opts.showTotals !== false;
  const currency = opts.currency ?? "CAD";
  const money = (n: number): string => `$${n.toFixed(2)}`;

  const itemRows = opts.items
    .map((it) => {
      const discount =
        it.discountAmount != null && Number(it.discountAmount) > 0
          ? ` <span style="color:${COLOR.grey500};">(&minus;${money(Number(it.discountAmount))})</span>`
          : "";
      const price =
        it.lineTotal != null && it.lineTotal !== ""
          ? money(Number(it.lineTotal))
          : "";
      return `<tr>
<td style="padding:11px 4px 11px 18px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.grey700};white-space:nowrap;vertical-align:top;">${it.quantity}&times;</td>
<td style="padding:11px 10px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.ink};vertical-align:top;">${escapeHtml(it.name)}${discount}</td>
<td style="padding:11px 18px 11px 10px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.5;color:${COLOR.ink};font-weight:600;text-align:right;white-space:nowrap;vertical-align:top;">${price}</td>
</tr>`;
    })
    .join("");

  let totalsRows = "";
  if (showTotals) {
    const subtotal = opts.items.reduce(
      (sum, it) => sum + Number(it.lineTotal ?? 0),
      0,
    );
    const deliveryFee = opts.deliveryFee ?? 0;
    const platformDiscount = opts.platformDiscount ?? 0;
    const tax = opts.tax ?? 0;

    const lineRow = (
      label: string,
      value: string,
      o: { strong?: boolean; border?: boolean } = {},
    ): string => {
      const border = o.border ? `border-top:1px solid ${COLOR.grey200};` : "";
      const size = o.strong ? "15px" : "13.5px";
      const labelColor = o.strong ? COLOR.ink : COLOR.grey700;
      const labelWeight = o.strong ? "700" : "400";
      const valueWeight = o.strong ? "700" : "600";
      const common = `font-family:${FONT_STACK};font-size:${size};line-height:1.5;`;
      return `<tr>
<td style="${border}padding:11px 4px 11px 18px;"></td>
<td style="${border}padding:11px 10px;${common}color:${labelColor};font-weight:${labelWeight};">${label}</td>
<td style="${border}padding:11px 18px 11px 10px;${common}color:${COLOR.ink};font-weight:${valueWeight};text-align:right;white-space:nowrap;">${value}</td>
</tr>`;
    };

    const totalText =
      opts.total != null && opts.total !== ""
        ? `${money(Number(opts.total))} ${currency}`
        : "-";

    totalsRows =
      lineRow("Subtotal", money(subtotal), { border: true }) +
      (deliveryFee > 0 ? lineRow("Delivery", money(deliveryFee)) : "") +
      (platformDiscount > 0
        ? lineRow("Discount", `&minus;${money(platformDiscount)}`)
        : "") +
      (tax > 0 ? lineRow(opts.taxLabel ?? "Tax", money(tax)) : "") +
      lineRow("Total", totalText, { strong: true, border: true });
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;border:1px solid ${COLOR.grey200};border-radius:14px;overflow:hidden;background-color:${COLOR.white};">${itemRows}${totalsRows}</table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${COLOR.ink};">${text}</p>`;
}

// Compact bullet list for short bits of guidance (e.g. delivery hand-off tips).
// Kept tight so a few pointers don't feel cluttered.
export function bulletList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLOR.ink};">${item}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding:0 0 0 22px;">${lis}</ul>`;
}

export function pickupCodeBlock(code: string, label = "Pickup code"): string {
  const spaced = escapeHtml(code.split("").join(" "));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr>
<td align="center" style="padding:28px 24px;background-color:${COLOR.white};border:1.5px solid ${COLOR.red};border-radius:14px;">
<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLOR.red};">${escapeHtml(label)}</p>
<div style="font-family:${FONT_STACK};font-size:36px;font-weight:700;line-height:1;letter-spacing:0.22em;color:${COLOR.ink};">${spaced}</div>
</td>
</tr>
</table>`;
}
