import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "7eats - Cook for Toronto",
  description:
    "7eats is the meal prep marketplace connecting home cooks in Toronto with people who want to eat well.",
  icons: {
    icon: "/7eats-icon-red.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
