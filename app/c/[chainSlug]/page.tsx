import { redirect } from "next/navigation";

export default async function ChainRoot(props: {
  params: Promise<{ chainSlug: string }>;
}) {
  const params = await props.params;
  redirect(`/c/${encodeURIComponent(params.chainSlug)}/order`);
}
