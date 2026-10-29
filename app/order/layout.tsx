import type { Metadata } from "next";

// Carts, checkout, confirmations and live tracking are personal and short
// lived. robots.txt already asks crawlers to stay out; this is the header that
// keeps them out even when a guest shares the link somewhere public.
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
