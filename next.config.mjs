/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Supabase Storage 에서 서빙되는 썸네일.
    // 이미지 업로드가 붙고 next/image 로 옮길 때 실제 호스트로 좁힌다.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

// 환경변수 검사는 scripts/check-env.mjs 가 build 스크립트에서 먼저 돌린다.
// 여기서 던지면 Next 가 "Failed to load next.config.mjs" 로 감싸버려서
// 어떤 변수가 없는지가 그 아래 묻힌다.

export default nextConfig;
