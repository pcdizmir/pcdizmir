import Papa from 'papaparse';
import { exhibitionTurkish } from './data/exhibition-tr.js';
import { artworkId } from './exhibition-links.js';

export const exhibitionColumns = [
  'title', 'artist', 'thumbnail', 'description_tr', 'description_en', 'artist_bio_tr', 'artist_bio_en',
];

const formQuestions = {
  title: 'Title of your work',
  description: 'Briefly describe your work',
  tools: 'Which programming languages, software, and tools',
  algorithms: 'What role do algorithms and rules',
  projectLinks: 'Do you have a link to the source code',
  artist: 'Artist Name or Handle',
  bio: 'Short Artist Biography',
};

function projectLinks(text = '') {
  const matches = text.match(/https?:\/\/[^\s|｜<>]+|(?:[a-z\d-]+\.)+[a-z]{2,}(?:\/[^\s|｜<>]*)?/gi) || [];
  return [...new Set(matches.map(match => {
    const value = match.replace(/[.,;]+$/, '');
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).href;
  }))];
}

export function parseExhibition(csv) {
  const result = Papa.parse(csv.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
    transform: value => value.trim(),
  });
  const fields = result.meta.fields || [];
  const formFields = Object.fromEntries(Object.entries(formQuestions).map(([key, question]) => [
    key, fields.find(field => field.toLowerCase().includes(question.toLowerCase())),
  ]));
  const isFormExport = Boolean(formFields.title && formFields.description && formFields.artist);
  if (result.errors.length || (!isFormExport && exhibitionColumns.some(column => !fields.includes(column)))) {
    throw new Error('Check the exhibition CSV headers, quotes, and column counts.');
  }

  const ids = new Set();
  return result.data.map((row, index) => {
    const formValue = key => row[formFields[key]] || '';
    const title = isFormExport ? formValue('title') : row.title;
    const artist = isFormExport ? formValue('artist') : row.artist;
    const thumbnail = (row.thumbnail || '').replace(/^\/assets\/exhibition\//, '');
    if (!title || /(^|\/)\.{1,2}(\/|$)|[\\?#:%]/.test(thumbnail) || thumbnail.startsWith('/')) {
      throw new Error(`Check the title, artist, and local thumbnail path in CSV row ${index + 2}.`);
    }
    const id = row.id || artworkId(title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
      throw new Error(`Provide a unique lowercase, hyphen-separated id in CSV row ${index + 2}.`);
    }
    ids.add(id);
    let artistUrl = '';
    if (row.artist_url) {
      const url = new URL(row.artist_url);
      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new Error(`Use an HTTP(S) artist URL in CSV row ${index + 2}.`);
      }
      artistUrl = url.href;
    }
    const description = isFormExport ? formValue('description') : '';
    const bio = isFormExport ? formValue('bio') : '';
    const algorithms = isFormExport ? formValue('algorithms') : '';
    const turkish = exhibitionTurkish[title] || {};
    const medium = row.medium || row.medium_en || row.medium_tr || (isFormExport ? formValue('tools') : '');
    return {
      id,
      title,
      artist,
      thumbnail: thumbnail ? `/assets/exhibition/${thumbnail}` : '',
      descriptionTr: row.description_tr || turkish.description || row.description_en || description,
      descriptionEn: row.description_en || description || row.description_tr || '',
      bioTr: row.artist_bio_tr || turkish.bio || row.artist_bio_en || bio,
      bioEn: row.artist_bio_en || bio || row.artist_bio_tr || '',
      algorithmsTr: row.algorithm_notes_tr || turkish.algorithms || row.algorithm_notes_en || algorithms,
      algorithmsEn: row.algorithm_notes_en || algorithms || row.algorithm_notes_tr || '',
      year: row.year || '',
      medium,
      mediumTr: row.medium_tr || turkish.medium || medium,
      mediumEn: row.medium_en || medium,
      artistUrl,
      projectLinks: projectLinks(isFormExport ? formValue('projectLinks') : row.project_links),
    };
  });
}
