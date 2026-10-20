import assert from 'node:assert/strict';
import { test } from 'node:test';
import Papa from 'papaparse';
import { readFileSync, existsSync } from 'node:fs';
import { parseExhibition, exhibitionColumns } from '../src/exhibition-data.js';
import { artworkId, artworkIndexForHash, artworkUrl } from '../src/exhibition-links.js';
import { selectPreviewArtworks } from '../src/exhibition-selection.js';

const artwork = {
  title: 'Şehir, "İzmir"',
  artist: 'Örnek Sanatçı',
  thumbnail: 'city.webp',
  description_tr: 'Birinci paragraf, bir alıntı: "kent".\n\nİkinci paragraf.',
  description_en: 'First paragraph.\n\nSecond paragraph.',
  artist_bio_tr: 'Sanatçı biyografisi.',
  artist_bio_en: 'Artist biography.',
};
const csv = rows => Papa.unparse(rows);

test('preview rotation selects three distinct artworks and avoids the previous batch', () => {
  const pool = Array.from({ length: 16 }, (_, index) => ({ id: String(index) }));
  const previous = ['0', '1', '2'];
  const selection = selectPreviewArtworks(pool, previous, 3, () => 0.5);
  assert.equal(selection.length, 3);
  assert.equal(new Set(selection.map(work => work.id)).size, 3);
  assert.ok(selection.every(work => !previous.includes(work.id)));
  assert.deepEqual(pool.map(work => work.id), Array.from({ length: 16 }, (_, index) => String(index)));
});

test('preview sampling handles empty and small exhibitions without duplicates', () => {
  assert.deepEqual(selectPreviewArtworks([]), []);
  const pool = [{ id: 'a' }, { id: 'b' }];
  assert.equal(selectPreviewArtworks(pool).length, 2);
  const result = selectPreviewArtworks([...pool, { id: 'c' }, { id: 'd' }], ['a', 'b', 'c']);
  assert.equal(result.length, 3);
  assert.equal(result[0].id, 'd');
  assert.equal(new Set(result.map(work => work.id)).size, 3);
});

test('artwork links normalize accents and Turkish letters and survive reordering', () => {
  assert.equal(artworkId('Şehir, "İzmir"'), 'sehir-izmir');
  assert.equal(artworkId('Résilience — Out of Band #2'), 'resilience-out-of-band-2');
  assert.equal(artworkId('Işık'), 'isik');
  const first = parseExhibition(csv([artwork, { ...artwork, title: 'Other' }]));
  const reversed = parseExhibition(csv([{ ...artwork, title: 'Other' }, artwork]));
  assert.equal(first[0].id, reversed[1].id);
  assert.equal(artworkUrl(first[0]), 'https://pcdizmir.kodart.xyz/exhibition.html#sehir-izmir');
  assert.equal(artworkIndexForHash(first, '#sehir-izmir'), 0);
  assert.equal(artworkIndexForHash(reversed, '#sehir-izmir'), 1);
});

test('explicit permanent IDs survive title changes, and ambiguous IDs are rejected', () => {
  const [first] = parseExhibition(csv([{ ...artwork, id: 'permanent-id' }]));
  const [renamed] = parseExhibition(csv([{ ...artwork, title: 'New title', id: 'permanent-id' }]));
  assert.equal(artworkUrl(first), artworkUrl(renamed));
  assert.throws(() => parseExhibition(csv([artwork, artwork])), /unique/);
  assert.throws(() => parseExhibition(csv([{ ...artwork, id: 'unsafe/#id' }])), /unique/);
});

test('hash navigation accepts encoded IDs and ignores missing, unknown, or malformed fragments', () => {
  const works = [{ id: 'work-1' }, { id: 'work-2' }];
  assert.equal(artworkIndexForHash(works, '#work%2D2'), 1);
  for (const hash of ['', '#unknown', '#%E0%A4%A']) assert.equal(artworkIndexForHash(works, hash), -1);
});

test('header-only and whitespace-only rows produce the coming-soon state', () => {
  assert.deepEqual(parseExhibition(`${exhibitionColumns.join(',')}\n\n,,,,,,\n`), []);
});

test('preserves artwork order, Unicode, commas, escaped quotes, and paragraph breaks', () => {
  const result = parseExhibition('\uFEFF' + csv([artwork, { ...artwork, title: 'Second work' }]));
  assert.equal(result.length, 2);
  assert.equal(result[0].title, artwork.title);
  assert.equal(result[0].descriptionTr, artwork.description_tr);
  assert.equal(result[0].artist, artwork.artist);
  assert.equal(result[1].title, 'Second work');
  assert.equal(result[0].thumbnail, '/assets/exhibition/city.webp');
});

test('accepts full local image paths, optional metadata, and missing translations', () => {
  const [result] = parseExhibition(csv([{
    ...artwork, thumbnail: '/assets/exhibition/city.webp', description_en: '',
    artist_bio_tr: '', year: '2026', medium: 'p5.js', artist_url: 'https://example.com',
  }]));
  assert.equal(result.descriptionEn, artwork.description_tr);
  assert.equal(result.bioTr, artwork.artist_bio_en);
  assert.equal(result.year, '2026');
  assert.equal(result.medium, 'p5.js');
  assert.equal(result.artistUrl, 'https://example.com/');
});

test('rejects malformed CSV, missing columns, and missing artwork identities', () => {
  assert.throws(() => parseExhibition('title,artist\nWork,Artist'));
  assert.throws(() => parseExhibition(exhibitionColumns.join(',') + '\n"unterminated'));
  assert.throws(() => parseExhibition(csv([{ ...artwork, title: '' }])));
});

test('rejects remote/traversal image paths and unsafe artist links', () => {
  for (const thumbnail of ['../secret.png', '/elsewhere.png', 'https://example.com/a.png', '%2e%2e/a.png']) {
    assert.throws(() => parseExhibition(csv([{ ...artwork, thumbnail }])));
  }
  assert.throws(() => parseExhibition(csv([{ ...artwork, artist_url: 'javascript:alert(1)' }])));
});

const formSubmission = {
  Timestamp: '2026-10-20',
  'Email address': 'private@example.com',
  'Çalışmanızın adı / Title of your work': 'İzmir',
  'Çalışmanızı kısaca açıklayınız / Briefly describe your work. ': 'First paragraph.\n\nSecond paragraph.',
  'Which programming languages, software, and tools did you use?': 'p5.js, GLSL',
  'What role do algorithms and rules play?': 'Noise and rules.',
  'Do you have a link to the source code or a working version?': 'https://example.com/art ｜ https://github.com/example/art',
  'Please upload your work': 'https://drive.google.com/private-upload',
  'Sanatçı İsmi veya mahlas/ Artist Name or Handle': '',
  'Kısa Sanatçı Biyografisi / Short Artist Biography': '',
};

test('accepts form headers and incomplete artist/image data without inventing values', () => {
  const [result] = parseExhibition(csv([formSubmission]));
  assert.equal(result.title, 'İzmir');
  assert.equal(result.artist, '');
  assert.equal(result.thumbnail, '');
  assert.equal(result.bioTr, '');
  assert.equal(result.descriptionTr, formSubmission['Çalışmanızı kısaca açıklayınız / Briefly describe your work. ']);
  assert.equal(result.descriptionEn, result.descriptionTr);
  assert.equal(result.medium, 'p5.js, GLSL');
  assert.equal(result.algorithmsTr, 'Noise and rules.');
  assert.deepEqual(result.projectLinks, ['https://example.com/art', 'https://github.com/example/art']);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('private@example.com'));
  assert.ok(!serialized.includes('2026-10-20'));
  assert.ok(!serialized.includes('private-upload'));
});

test('form exports accept explicit thumbnails/translations and scheme-free project links', () => {
  const [result] = parseExhibition(csv([{
    ...formSubmission, thumbnail: 'izmir.png', description_tr: 'Türkçe açıklama.',
    'Do you have a link to the source code or a working version?': 'example.com/art',
  }]));
  assert.equal(result.thumbnail, '/assets/exhibition/izmir.png');
  assert.equal(result.descriptionTr, 'Türkçe açıklama.');
  assert.equal(result.descriptionEn, formSubmission['Çalışmanızı kısaca açıklayınız / Briefly describe your work. ']);
  assert.deepEqual(result.projectLinks, ['https://example.com/art']);
});

test('loads every supplied submission in CSV order and excludes administrative columns', () => {
  const text = readFileSync(new URL('../src/data/exhibition.csv', import.meta.url), 'utf8');
  const source = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  const result = parseExhibition(text);
  assert.equal(result.length, source.data.length);
  const titleHeader = source.meta.fields.find(field => field.includes('Title of your work')) || 'title';
  assert.deepEqual(result.map(work => work.title), source.data.map(row => row[titleHeader].trim()));
  const serialized = JSON.stringify(result);
  source.data.forEach(row => {
    if (row['Email address']) assert.ok(!serialized.includes(row['Email address']));
    if (row.Timestamp) assert.ok(!serialized.includes(row.Timestamp));
  });
});

test('provides Turkish translations for English submissions without changing their originals', () => {
  const text = readFileSync(new URL('../src/data/exhibition.csv', import.meta.url), 'utf8');
  const source = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: header => header.trim() });
  const works = parseExhibition(text);
  const titleHeader = source.meta.fields.find(field => field.includes('Title of your work')) || 'title';
  const descriptionHeader = source.meta.fields.find(field => field.includes('Briefly describe your work')) || 'description_en';
  const bioHeader = source.meta.fields.find(field => field.includes('Short Artist Biography')) || 'artist_bio_en';
  const algorithmHeader = source.meta.fields.find(field => field.includes('What role do algorithms')) || 'algorithm_notes_en';
  for (const title of ['Reaction Diffusion Explorer', 'inkField', 'Idoni', 'Résilience — Out of Band #2', 'Stratum', 'Semantic Noise', 'Glass shattered, but I still see.', 'chet', 'stranded(ness)', 'Some Parts of Me', "I think I'm going blind", 'Feelings']) {
    const work = works.find(work => work.title === title);
    const original = source.data.find(row => row[titleHeader] === title);
    assert.ok(work.descriptionTr, `Missing Turkish description: ${title}`);
    assert.notEqual(work.descriptionTr, work.descriptionEn, `Untranslated description: ${title}`);
    assert.equal(work.descriptionEn, original[descriptionHeader].trim());
  }
  for (const title of ['Reaction Diffusion Explorer', 'Altered State of Line', 'Résilience — Out of Band #2', 'Stratum', 'stranded(ness)', 'Some Parts of Me', "I think I'm going blind", 'Feelings']) {
    const work = works.find(work => work.title === title);
    const original = source.data.find(row => row[titleHeader] === title);
    assert.ok(work.bioTr);
    assert.notEqual(work.bioTr, work.bioEn, `Untranslated biography: ${title}`);
    assert.equal(work.bioEn, original[bioHeader].trim());
  }
  for (const title of ['Reaction Diffusion Explorer', 'inkField', 'Idoni', 'Résilience — Out of Band #2', 'Stratum', 'Semantic Noise', 'stranded(ness)', 'Some Parts of Me', "I think I'm going blind", 'Feelings']) {
    const work = works.find(work => work.title === title);
    const original = source.data.find(row => row[titleHeader] === title);
    assert.ok(work.algorithmsTr);
    assert.notEqual(work.algorithmsTr, work.algorithmsEn, `Untranslated algorithm notes: ${title}`);
    assert.equal(work.algorithmsEn, original[algorithmHeader].trim());
  }
  const turkishWork = works.find(work => work.title === 'monolith');
  assert.equal(turkishWork.descriptionTr, turkishWork.descriptionEn);
  assert.equal(turkishWork.bioTr, turkishWork.bioEn);
  const ink = works.find(work => work.title === 'inkField');
  assert.notEqual(ink.mediumTr, ink.mediumEn);
});

test('the public CSV has no administrative/Drive data and all assigned thumbnails exist', () => {
  const text = readFileSync(new URL('../src/data/exhibition.csv', import.meta.url), 'utf8');
  assert.ok(!/Email address|Timestamp|drive\.google\.com|docs\.google\.com/.test(text));
  const works = parseExhibition(text);
  for (const work of works) {
    if (work.thumbnail) {
      assert.ok(existsSync(new URL(`../public${work.thumbnail}`, import.meta.url)), work.thumbnail);
    }
    assert.ok(work.id);
    if (work.mediumTr || work.mediumEn) assert.ok(work.medium);
  }
  const [incomplete] = parseExhibition(csv([{ ...artwork, artist: '', thumbnail: '', medium_tr: 'Türkçe araçlar' }]));
  assert.equal(incomplete.artist, '');
  assert.equal(incomplete.thumbnail, '');
  assert.equal(incomplete.mediumTr, 'Türkçe araçlar');
});

test('explicit CSV translations take priority over the Turkish copy without replacing original English', () => {
  const [work] = parseExhibition(csv([{
    ...formSubmission,
    'Çalışmanızın adı / Title of your work': 'Reaction Diffusion Explorer',
    description_tr: 'Özel Türkçe açıklama.',
    artist_bio_tr: 'Özel biyografi.',
    algorithm_notes_tr: 'Özel algoritma açıklaması.',
  }]));
  assert.equal(work.descriptionTr, 'Özel Türkçe açıklama.');
  assert.equal(work.bioTr, 'Özel biyografi.');
  assert.equal(work.algorithmsTr, 'Özel algoritma açıklaması.');
  assert.equal(work.descriptionEn, formSubmission['Çalışmanızı kısaca açıklayınız / Briefly describe your work. ']);
});
