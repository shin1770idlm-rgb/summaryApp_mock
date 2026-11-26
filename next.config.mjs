/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true }, // ESLintの設定を置いていないため、ビルド時のlintは行わない
};
export default nextConfig;
