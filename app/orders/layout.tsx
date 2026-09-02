import type { Metadata } from "next";

// A guest's own order history — personal, and meaningless to a crawler.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
