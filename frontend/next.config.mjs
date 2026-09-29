/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // necesario para static export
  },
  // Base path si se despliega en un subdirectorio
  // basePath: '/oficina-fusion',
};

export default nextConfig;
