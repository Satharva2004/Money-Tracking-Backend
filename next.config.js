/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fix for Firebase Admin SDK
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'firebase-admin': 'commonjs firebase-admin',
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
      });
    }
    
    return config;
  },
  // Suppress warnings about .env file
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', '@tensorflow/tfjs-node'],
  },
};

module.exports = nextConfig;
