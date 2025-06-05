/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
      // Add alias for the problematic node-specific Konva file
      config.resolve.alias = {
        ...config.resolve.alias,
        'konva/lib/index-node.js': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;