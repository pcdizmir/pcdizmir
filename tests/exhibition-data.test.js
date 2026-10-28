import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { parseExhibition } from '../src/exhibition-data.js';
import { artworkId, artworkIndexForHash, artworkUrl } from '../src/exhibition-links.js';
import { selectPreviewArtworks } from '../src/exhibition-selection.js';
import { imageDimensions, sortArtworksByOrientation, webpDimensions } from '../scripts/exhibition-orientation.mjs';

const sample = {
  id: 'sehir-izmir',
  title: 'Şehir, "İzmir"',
  artist: 'Örnek Sanatçı',
  thumbnail: '/assets/exhibition/city.webp',
  descriptionTr: 'Birinci paragraf, bir alıntı: "kent".\n\nİkinci paragraf.',
  descriptionEn: 'First paragraph.\n\nSecond paragraph.',
  bioTr: 'Sanatçı biyografisi.',
  bioEn: 'Artist biography.',
};
const parse = works => parseExhibition(JSON.stringify(works));
const artworks = parseExhibition(readFileSync(new URL('../src/data/exhibition.json', import.meta.url), 'utf8'));

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

test('exhibition groups landscape, square, and portrait images without changing order within a group', () => {
  const works = ['portrait-a', 'landscape-a', 'square', 'landscape-b', 'portrait-b'].map(id => ({ id }));
  const sizes = [
    { width: 540, height: 960 },
    { width: 960, height: 540 },
    { width: 960, height: 960 },
    { width: 960, height: 600 },
    { width: 720, height: 960 },
  ];
  assert.deepEqual(sortArtworksByOrientation(works, sizes).map(work => work.id), [
    'landscape-a', 'landscape-b', 'square', 'portrait-a', 'portrait-b',
  ]);
  assert.equal(webpDimensions(readFileSync(new URL('../public/assets/exhibition/monolith - oğuz ülgen tunç.webp', import.meta.url))).width, 686);
  assert.deepEqual(imageDimensions(readFileSync(new URL('../public/assets/exhibition/project_nom.png', import.meta.url))), { width: 800, height: 450 });
});

test('artwork links survive title changes and reordering', () => {
  assert.equal(artworkId(sample.title), sample.id);
  assert.equal(artworkId('Résilience — Out of Band #2'), 'resilience-out-of-band-2');
  const first = parse([sample, { ...sample, id: 'other', title: 'Other' }]);
  const reversed = parse([{ ...sample, id: 'other', title: 'Other' }, { ...sample, title: 'New title' }]);
  assert.equal(artworkUrl(first[0]), artworkUrl(reversed[1]));
  assert.equal(artworkIndexForHash(first, '#sehir-izmir'), 0);
  assert.equal(artworkIndexForHash(reversed, '#sehir-izmir'), 1);
  assert.equal(artworkIndexForHash(first, '#sehir%2Dizmir'), 0);
  for (const hash of ['', '#unknown', '#%E0%A4%A']) assert.equal(artworkIndexForHash(first, hash), -1);
});

test('JSON keeps Unicode, quotes, order, and paragraph breaks', () => {
  const result = parseExhibition('\uFEFF' + JSON.stringify([sample, { ...sample, id: 'second', title: 'Second work' }]));
  assert.deepEqual(result.map(work => work.title), [sample.title, 'Second work']);
  assert.equal(result[0].descriptionTr, sample.descriptionTr);
  assert.equal(result[0].thumbnail, sample.thumbnail);
  assert.deepEqual(parse([]), []);
});

test('optional fields stay editable and missing details stay empty', () => {
  const [work] = parse([{ ...sample, artistLocation: 'İzmir', mediumTr: 'Türkçe araçlar', year: '2026', artistUrl: 'https://example.com', projectLinks: ['https://example.com/art'] }]);
  assert.equal(work.artistLocation, 'İzmir');
  assert.equal(work.medium, 'Türkçe araçlar');
  assert.equal(work.artistUrl, 'https://example.com/');
  assert.deepEqual(work.projectLinks, ['https://example.com/art']);
  const [incomplete] = parse([{ id: 'unfinished', title: 'Unfinished' }]);
  assert.equal(incomplete.artist, '');
  assert.equal(incomplete.artistLocation, '');
  assert.equal(incomplete.thumbnail, '');
  assert.equal(incomplete.descriptionTr, '');
  assert.deepEqual(incomplete.projectLinks, []);
});

test('invalid JSON, identities, paths, and links fail validation', () => {
  assert.throws(() => parseExhibition('{'), /Invalid exhibition JSON/);
  assert.throws(() => parseExhibition('{}'), /array/);
  assert.throws(() => parse([null]), /object/);
  assert.throws(() => parse([{ ...sample, title: '' }]), /title/);
  assert.throws(() => parse([sample, sample]), /unique/);
  assert.throws(() => parse([{ ...sample, id: 'unsafe/#id' }]), /unique/);
  for (const thumbnail of ['../secret.png', '/elsewhere.png', 'https://example.com/a.png', '/assets/exhibition/%2e%2e/a.png']) {
    assert.throws(() => parse([{ ...sample, thumbnail }]), /thumbnail/);
  }
  assert.throws(() => parse([{ ...sample, artistUrl: 'javascript:alert(1)' }]), /artistUrl/);
  assert.throws(() => parse([{ ...sample, projectLinks: ['javascript:alert(1)'] }]), /projectLinks/);
});

test('the JSON includes all artwork details and mapped thumbnails', () => {
  assert.equal(artworks.length, 26);
  assert.equal(artworks.filter(work => work.artistLocation).length, 26);
  assert.equal(artworks.find(work => work.id === 'noema').artistLocation, 'Poland/Georgia');
  assert.equal(artworks.find(work => work.id === 'some-parts-of-me').artistLocation, 'Düsseldorf');
  assert.equal(artworks.find(work => work.id === 'underlayer').artistLocation, 'İstanbul');
  assert.ok(artworks.filter(work => work.artistLocation === 'İzmir').length > 0);
  assert.equal(artworks.find(work => work.id === 'noema').artist, 'Paweł Dudko');
  assert.equal(artworks.find(work => work.id === 'traces-of-intervention').artist, 'Gözde Damla Turhan');
  assert.equal(artworks.filter(work => work.thumbnail).length, 26);
  const aladdin = artworks.find(work => work.id === 'son-of-aladdin');
  assert.equal(aladdin.artist, 'Yusuf Samet Aydın ve Şeyma Gül Aydın');
  assert.equal(aladdin.thumbnail, '/assets/exhibition/project_nom.png');
  assert.deepEqual(aladdin.projectLinks, ['https://www.youtube.com/watch?v=BVP_E6TB0S8']);
  assert.equal(artworks.find(work => work.title === 'Memento').thumbnail, '/assets/exhibition/memento-loop - Berkin Dündar.webp');
  assert.equal(artworks.find(work => work.title === 'Glass shattered, but I still see.').thumbnail, '/assets/exhibition/trim_E112025F-AB03-4689-8A49-5797620C0668 (1) - Ali Osman Bayram.webp');
  const raphael = artworks.find(work => work.title === 'Raphaël de Courville');
  assert.equal(raphael.artist, 'Raphaël de Courville');
  assert.equal(raphael.thumbnail, '/assets/exhibition/raphael_s171029_alt_landscape_4min.webp');
  assert.ok(raphael.descriptionTr);
  for (const work of artworks) {
    assert.ok(existsSync(new URL(`../public${work.thumbnail}`, import.meta.url)), work.thumbnail);
    if (work.mediumTr || work.mediumEn) assert.ok(work.medium);
  }
});

test('Turkish and English artwork text remains available', () => {
  for (const title of ['inkField', 'Idoni', 'Résilience — Out of Band #2', 'Stratum', 'Semantic Noise', 'possibilities // 01', 'stranded(ness)', 'Some Parts of Me', "I think I'm going blind", 'Feelings', 'Son of Aladdin']) {
    const work = artworks.find(work => work.title === title);
    assert.ok(work.descriptionTr && work.descriptionEn, title);
    assert.notEqual(work.descriptionTr, work.descriptionEn, title);
    if (work.algorithmsEn) assert.ok(work.algorithmsTr, title);
  }
  const ink = artworks.find(work => work.title === 'inkField');
  assert.notEqual(ink.mediumTr, ink.mediumEn);
});
