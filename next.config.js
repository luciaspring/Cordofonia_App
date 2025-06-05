/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark `canvas` as external on the server-side to prevent WebAssembly memory issues
      config.externals.push('canvas')
    }
    
    return config
  },
  // Enable strict mode for better development experience
  reactStrictMode: true,
  // Disable server components since we're using client-side canvas operations
  experimental: {
    serverActions: false
  }
}

module.exports = nextConfig