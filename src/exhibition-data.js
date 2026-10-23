import { artworkId } from './exhibition-links.js';

const textFields = [
  'artist', 'descriptionTr', 'descriptionEn', 'bioTr', 'bioEn',
  'algorithmsTr', 'algorithmsEn', 'year', 'mediumTr', 'mediumEn', 'artistUrl',
];

export function parseExhibition(json) {
  let entries;
  try {
    entries = typeof json === 'string' ? JSON.parse(json.replace(/^\uFEFF/, '')) : json;
  } catch (error) {
    throw new Error(`Invalid exhibition JSON: ${error.message}`);
  }
  if (!Array.isArray(entries)) throw new Error('Exhibition JSON must be an array of artworks.');

  const ids = new Set();
  return entries.map((entry, index) => {
    const location = `artwork ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Exhibition ${location} must be an object.`);
    }
    if (typeof entry.title !== 'string' || !entry.title.trim()) {
      throw new Error(`Exhibition ${location} needs a title.`);
    }
    const title = entry.title.trim();
    const id = entry.id === undefined ? artworkId(title) : entry.id;
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
      throw new Error(`Exhibition ${location} needs a unique lowercase, hyphen-separated id.`);
    }
    ids.add(id);

    const thumbnail = entry.thumbnail ?? '';
    if (typeof thumbnail !== 'string' || (thumbnail && (
      !thumbnail.startsWith('/assets/exhibition/') ||
      thumbnail === '/assets/exhibition/' ||
      /(^|\/)\.{1,2}(\/|$)|[\\?#:%]/.test(thumbnail)
    ))) {
      throw new Error(`Exhibition ${location} needs a local /assets/exhibition/ thumbnail path.`);
    }

    const strings = {};
    for (const field of textFields) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') {
        throw new Error(`Exhibition ${location} field ${field} must be text.`);
      }
      strings[field] = entry[field] || '';
    }
    if (strings.artistUrl && !/^https?:\/\//i.test(strings.artistUrl)) {
      throw new Error(`Exhibition ${location} artistUrl must be an HTTP(S) URL.`);
    }
    if (strings.artistUrl) {
      try { strings.artistUrl = new URL(strings.artistUrl).href; } catch {
        throw new Error(`Exhibition ${location} artistUrl must be an HTTP(S) URL.`);
      }
    }

    const projectLinks = entry.projectLinks ?? [];
    if (!Array.isArray(projectLinks) || projectLinks.some(link => typeof link !== 'string' || !/^https?:\/\//i.test(link))) {
      throw new Error(`Exhibition ${location} projectLinks must be an array of HTTP(S) URLs.`);
    }
    for (const link of projectLinks) {
      try { new URL(link); } catch {
        throw new Error(`Exhibition ${location} projectLinks must be an array of HTTP(S) URLs.`);
      }
    }

    return {
      id, title, artist: strings.artist, thumbnail,
      descriptionTr: strings.descriptionTr, descriptionEn: strings.descriptionEn,
      bioTr: strings.bioTr, bioEn: strings.bioEn,
      algorithmsTr: strings.algorithmsTr, algorithmsEn: strings.algorithmsEn,
      year: strings.year, medium: strings.mediumEn || strings.mediumTr,
      mediumTr: strings.mediumTr, mediumEn: strings.mediumEn,
      artistUrl: strings.artistUrl, projectLinks,
    };
  });
}
