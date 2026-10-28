import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseExhibition } from './src/exhibition-data.js';
import { imageDimensions, sortArtworksByOrientation } from './scripts/exhibition-orientation.mjs';

const exhibitionJson = fileURLToPath(new URL('./src/data/exhibition.json', import.meta.url));
const exhibitionModule = 'virtual:exhibition-artworks';
const exhibitionPreviewModule = 'virtual:exhibition-preview';

// Only validated artwork fields reach the client.
function exhibitionContent() {
  return {
    name: 'exhibition-content',
    resolveId(id) {
      if ([exhibitionModule, exhibitionPreviewModule].includes(id)) return '\0' + id;
    },
    async load(id) {
      if (![exhibitionModule, exhibitionPreviewModule].some(name => id === '\0' + name)) return;
      this.addWatchFile(exhibitionJson);
      const artworks = parseExhibition(await readFile(exhibitionJson, 'utf8'));
      if (id === '\0' + exhibitionPreviewModule) {
        const preview = artworks.map(({ id, title, artist, thumbnail }) => ({ id, title, artist, thumbnail }));
        return `export default ${JSON.stringify(preview)};`;
      }
      const dimensions = await Promise.all(artworks.map(async ({ thumbnail }) => {
        if (!thumbnail) return null;
        const imagePath = fileURLToPath(new URL(`./public${thumbnail}`, import.meta.url));
        this.addWatchFile(imagePath);
        return imageDimensions(await readFile(imagePath));
      }));
      return `export default ${JSON.stringify(sortArtworksByOrientation(artworks, dimensions))};`;
    },
    handleHotUpdate({ file, server }) {
      if (file !== exhibitionJson) return;
      for (const name of [exhibitionModule, exhibitionPreviewModule]) {
        const module = server.moduleGraph.getModuleById('\0' + name);
        if (module) server.moduleGraph.invalidateModule(module);
      }
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  plugins: [exhibitionContent()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        faq: 'sss.html',
        exhibition: 'exhibition.html'
      }
    }
  }
});
