/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@farcaster/mini-app-solana": false,
      "@solana-program/memo": false,
      "@abstract-foundation/agw-client": false,
      "@abstract-foundation/agw-client/actions": false,
      "@stripe/crypto": false,
      "permissionless": false,
      "permissionless/accounts": false,
      "permissionless/clients/pimlico": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};
module.exports = nextConfig;
