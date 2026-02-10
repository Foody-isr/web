import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Foody - Order Food Online",
  description: "Order your favorite food online with Foody - Fast, easy, and delicious."
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
