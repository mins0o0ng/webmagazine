/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Supabase Storage 에서 서빙되는 썸네일.
    // 프로젝트 생성 후 실제 호스트로 교체한다.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
