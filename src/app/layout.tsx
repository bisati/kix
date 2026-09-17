import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fair Teams — balanced football teams in 30 seconds",
  description:
    "Pick who showed up, get two evenly matched teams with the fairness proof visible. Position balance, skill-tier spread, and game-controller splits — verified, not vibes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
