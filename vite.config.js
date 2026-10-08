import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
 plugins: [react(), VitePWA({
  registerType: 'prompt',
  includeAssets: ['icons/*.png', 'images/*'],
  manifest: {
   id: '/', name: '换换 · 闲置交换', short_name: '换换', description: '用闲置交换新的喜欢。当前版本数据仅保存在本机。',
   lang: 'zh-CN', start_url: '/?source=installed', scope: '/', display: 'standalone',
   background_color: '#fafbf8', theme_color: '#487451', categories: ['shopping', 'lifestyle'],
   icons: [{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'}, {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]
  },
  workbox: {globPatterns:['**/*.{js,css,html,woff2,png,jpg,webp}'], maximumFileSizeToCacheInBytes: 3000000, navigateFallback: '/index.html', cleanupOutdatedCaches:true}
 })],
 server: {host:'0.0.0.0',allowedHosts:['.e2b.app'],port:5173},
 preview: {host:'0.0.0.0',allowedHosts:['.e2b.app'],port:4173}
});
