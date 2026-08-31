/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || "https://foody-pos.co.il";

    return [
      {
        source: "/",
        destination: `${marketingUrl}/he`,
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
