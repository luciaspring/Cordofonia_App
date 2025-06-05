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
    
    // Configure WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Increase memory limit for WebAssembly
    config.performance = {
      ...config.performance,
      maxAssetSize: 1024 * 1024 * 10, // 10MB
      maxEntrypointSize: 1024 * 1024 * 10, // 10MB
    };

    return config;
  },
};

module.exports = nextConfig;