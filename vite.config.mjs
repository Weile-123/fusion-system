import { defineConfig } from 'vite';
import { createReadStream, cpSync, existsSync, statSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const legacyAssets = resolve('h5/assets');
const feedbackApplicationId = JSON.parse(readFileSync(resolve('hupu-ai-game-skills/activity.json'), 'utf8')).activityId;
if (!/^app_[0-9a-f]{10}$/.test(feedbackApplicationId)) throw new Error('Invalid feedback activityId');
const assetTypes = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function legacyStaticAssets() {
  return {
    name: 'legacy-static-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (request, response, next) => {
        const relativePath = decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/, '');
        const file = resolve(legacyAssets, relativePath);
        if (!file.startsWith(`${legacyAssets}${sep}`) || !existsSync(file) || !statSync(file).isFile()) return next();
        response.setHeader('Content-Type', assetTypes[extname(file).toLowerCase()] || 'application/octet-stream');
        createReadStream(file).pipe(response);
      });
    },
    closeBundle() {
      cpSync(legacyAssets, resolve('dist/assets'), { recursive: true });
    }
  };
}

export default defineConfig({
  define: { __FEEDBACK_APPLICATION_ID__: JSON.stringify(feedbackApplicationId) },
  base: './',
  publicDir: false,
  plugins: [legacyStaticAssets()],
  resolve: {
    alias: {
      '@fusion/dom/jsx-runtime': resolve('src/dom-runtime.mjs'),
      '@fusion/dom/jsx-dev-runtime': resolve('src/dom-runtime.mjs')
    }
  },
  esbuild: { jsx: 'automatic', jsxImportSource: '@fusion/dom' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false }
  }
});
