import { readFile, writeFile } from 'node:fs/promises';
import { parseExhibition } from '../src/exhibition-data.js';
import { artworkUrl } from '../src/exhibition-links.js';

const artworks = parseExhibition(await readFile(new URL('../src/data/exhibition.json', import.meta.url), 'utf8'));
const entries = artworks.map(artwork => `- **${artwork.title}**${artwork.artist && artwork.artist !== artwork.title ? ` — ${artwork.artist}` : ''}\n  ${artworkUrl(artwork)}`);
await writeFile(new URL('../exhibition-links.md', import.meta.url), [
  '# Exhibition artwork links',
  'Use these URLs to generate the printed QR codes. Each link opens the artwork and expands its information. The live site must include the latest exhibition deployment.',
  ...entries,
].join('\n\n') + '\n');
console.log(`Wrote ${artworks.length} artwork links to exhibition-links.md.`);
