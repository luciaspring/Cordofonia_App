/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Handle canvas module for client-side only
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false
      };
    }

    // Properly handle Konva's Node.js specific imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'konva/lib/index-node.js': false,
      'konva$': 'konva/lib/index.js'
    };

    // Externalize problematic modules for server build
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas', 'konva'];
    }

    return config;
  },
};

module.exports = nextConfig;