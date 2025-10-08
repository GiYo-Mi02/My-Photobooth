// Minimal global declarations to avoid needing @types/node for this config file
/* eslint-disable */
declare const process: any;
declare const console: any;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to ignore hot updates originating from any uploads folder
function ignoreUploadsHmr() {
  return {
    name: 'ignore-uploads-hmr',
    // ctx: { file: string }
    handleHotUpdate(ctx: any) {
      const f = (ctx.file || '').replace(/\\/g, '/');
      if (f.includes('/uploads/photos') || f.includes('/uploads/photostrips') || f.includes('/uploads/templates')) {
        // eslint-disable-next-line no-console
        console.log('[HMR] Ignoring hot update from', f);
        return [];
      }
      return undefined;
    }
  };
}

const noHmr = typeof process !== 'undefined' && process.env && process.env.NO_HMR === '1';

// IMPORTANT: When a new photo is captured the backend writes a file into uploads/.
// Vite's dev server (HMR) can detect file additions if that folder is inside the
// project tree and trigger a full reload, causing the webcam component to unmount
// and remount mid auto-capture. We explicitly ignore that directory.

export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    ignoreUploadsHmr()
  ],
  server: {
    hmr: noHmr ? false : { overlay: true },
    watch: {
      ignored: [
        '../uploads/**',
        '../backend/uploads/**',
        '**/uploads/**'
      ]
    }
  }
});
