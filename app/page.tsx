import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || "https://foody-pos.co.il";

export const metadata: Metadata = {
  title: "Foody",
  robots: { index: false, follow: true },
};

export default function Home() {
  permanentRedirect(`${MARKETING_URL}/he`);
}
