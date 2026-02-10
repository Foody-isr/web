import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.foody-pos.co.il";

export const metadata: Metadata = {
  title: "Foody - Order Food Online",
  description: "Order your favorite food online with Foody - Fast, easy, and delicious.",
  openGraph: {
    title: "Foody - Order Food Online",
    description: "Order your favorite food online with Foody - Fast, easy, and delicious.",
    type: "website",
    url: APP_URL,
    siteName: "Foody",
    images: [
      {
        url: `${APP_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "Foody - Order Food Online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Foody - Order Food Online",
    description: "Order your favorite food online with Foody - Fast, easy, and delicious.",
    images: [`${APP_URL}/api/og`],
  },
};

export const viewport: Viewport = {
  themeColor: "#121316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-[var(--bg-page)] text-[var(--text)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
