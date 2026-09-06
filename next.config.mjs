import { checkEnv, checkNoLeakedSecrets } from './lib/env.mjs';

// 배포된 다음 첫 요청에서 500 으로 죽는 대신 빌드에서 막는다.
checkEnv();
checkNoLeakedSecrets();

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

export default nextConfig;
