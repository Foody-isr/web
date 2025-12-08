/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  i18n: {
    locales: ["en", "he"],
    defaultLocale: "en"
  }
};

export default nextConfig;
