/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  experimental: {
    serverActions: {
      // Portal uploads (contracts, files) are capped at 4 MB in the action itself; Vercel
      // functions accept up to 4.5 MB
      bodySizeLimit: '4.5mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [55, 75],
  },
};

export default nextConfig;
