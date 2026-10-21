import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function normalizeBasePath(value) {
  const path = String(value || '/').trim() || '/';
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = String(env.API_PROXY_TARGET || '').trim();
  const base = normalizeBasePath(process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/');

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icons/*.png', 'images/*'],
        manifest: {
          id: base,
          name: '换换 · 闲置交换',
          short_name: '换换',
          description: '用闲置交换新的喜欢。当前版本数据仅保存在本机。',
          lang: 'zh-CN',
          start_url: `${base}?source=installed`,
          scope: base,
          display: 'standalone',
          background_color: '#fafbf8',
          theme_color: '#487451',
          categories: ['shopping', 'lifestyle'],
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,webp}'],
          maximumFileSizeToCacheInBytes: 3000000,
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: /\.woff2?$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-assets',
                expiration: { maxEntries: 32, maxAgeSeconds: 31536000 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      port: 5173,
      proxy: apiProxyTarget ? { '/api': { target: apiProxyTarget, changeOrigin: true } } : {},
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      port: 4173,
      proxy: apiProxyTarget ? { '/api': { target: apiProxyTarget, changeOrigin: true } } : {},
    },
  };
});
