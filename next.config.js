/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle canvas module on client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false
      };
      
      // Handle Konva node-specific file
      config.resolve.alias = {
        ...config.resolve.alias,
        'konva/lib/index-node.js': false
      };
    }
    
    // Optimize WebAssembly memory usage
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };

    // Increase memory limit for WebAssembly
    config.performance = {
      ...config.performance,
      hints: false
    };

    return config;
  }
};

module.exports = nextConfig;