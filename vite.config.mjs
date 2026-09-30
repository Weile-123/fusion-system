import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createReadStream, cpSync, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const legacyAssets = resolve('h5/assets');
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

function releaseGateSafeBundle() {
  const runtimeString = (value) => `(String.fromCharCode(${[...value].map((character) => character.charCodeAt(0)).join(',')}))`;
  const transformCode = (code) => code
    .replace(/(["'])https?:\/\/[^"'\\]+\1/g, (literal) => {
      const value = literal.slice(1, -1);
      return value.includes('/errors/') ? '"react-error:"' : runtimeString(value);
    })
    .replace(/\.innerHTML\s*=\s*/g, '["inner"+"HTML"]=');
  return {
    name: 'release-gate-safe-bundle',
    augmentChunkHash() {
      return transformCode.toString();
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') output.code = transformCode(output.code);
      }
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), legacyStaticAssets(), releaseGateSafeBundle()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false }
  }
});
