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
        canvas: false
      };
      
      config.resolve.alias = {
        ...config.resolve.alias,
        'konva/lib/index-node.js': false,
        'konva$': 'konva/lib/index.js'
      };
    }

    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas', 'konva'];
    }

    return config;
  },
};

module.exports = nextConfig;