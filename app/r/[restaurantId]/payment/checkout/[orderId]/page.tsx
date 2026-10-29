import { redirect } from 'next/navigation';

/** Existing private links enter the restaurant's normal cart and checkout journey. */
export default async function PreparedCheckoutLink({ params, searchParams }: {
  params: Promise<{ restaurantId: string; orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { restaurantId, orderId } = await params;
  const search = await searchParams;
  const query = new URLSearchParams({ restaurantId, preparedOrderId: orderId });
  for (const key of ['t', 'lang']) if (typeof search[key] === 'string') query.set(key, search[key]);
  redirect(`/order/cart?${query}`);
}
