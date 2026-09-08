import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

const githubPagesPlugin = (): Plugin => ({
  name: 'github-pages-fallback',
  closeBundle() {
    try {
      const distDir = path.resolve(__dirname, 'dist');
      const docsDir = path.resolve(__dirname, 'docs');
      const distIndex = path.resolve(distDir, 'index.html');
      const dist404 = path.resolve(distDir, '404.html');
      const noJekyll = path.resolve(distDir, '.nojekyll');

      // Create .nojekyll
      fs.writeFileSync(noJekyll, '');

      // Create 404.html from index.html for SPA routing on GitHub Pages
      if (fs.existsSync(distIndex)) {
        fs.copyFileSync(distIndex, dist404);
      }

      // Mirror build output to docs/ for users who prefer GitHub Pages "Deploy from branch -> /docs"
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      fs.cpSync(distDir, docsDir, { recursive: true });
    } catch (e) {
      console.warn('Failed in githubPagesPlugin:', e);
    }
  },
});

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), githubPagesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
