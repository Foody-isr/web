import { redirect } from "next/navigation";

export default function ChainRoot({ params }: { params: { chainSlug: string } }) {
  redirect(`/c/${encodeURIComponent(params.chainSlug)}/order`);
}
