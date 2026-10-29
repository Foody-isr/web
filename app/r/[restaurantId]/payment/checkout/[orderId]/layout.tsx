import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Foody', robots: { index: false, follow: false }, referrer: 'no-referrer',
};

/** Applies private-checkout metadata to the prepared basket route. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
