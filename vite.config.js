import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseExhibition } from './src/exhibition-data.js';

const exhibitionCsv = fileURLToPath(new URL('./src/data/exhibition.csv', import.meta.url));
const exhibitionModule = 'virtual:exhibition-artworks';
const exhibitionPreviewModule = 'virtual:exhibition-preview';

// Only curated public fields reach the client, never the original form export.
function exhibitionContent() {
  return {
    name: 'exhibition-content',
    resolveId(id) {
      if ([exhibitionModule, exhibitionPreviewModule].includes(id)) return '\0' + id;
    },
    async load(id) {
      if (![exhibitionModule, exhibitionPreviewModule].some(name => id === '\0' + name)) return;
      this.addWatchFile(exhibitionCsv);
      const artworks = parseExhibition(await readFile(exhibitionCsv, 'utf8'));
      if (id === '\0' + exhibitionPreviewModule) {
        const preview = artworks.map(({ id, title, artist, thumbnail }) => ({ id, title, artist, thumbnail }));
        return `export default ${JSON.stringify(preview)};`;
      }
      return `export default ${JSON.stringify(artworks)};`;
    },
    handleHotUpdate({ file, server }) {
      if (file !== exhibitionCsv) return;
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
