import allArtworks from 'virtual:exhibition-preview';
import { selectPreviewArtworks } from './exhibition-selection.js';

const rotationInterval = 8000;
const artworks = allArtworks.filter(artwork => artwork.thumbnail);

export function renderExhibitionPreview() {
  const container = document.getElementById('exhibition-preview');
  if (!container) return;
  if (!artworks.length) {
    const message = document.createElement('p');
    message.textContent = 'Sergi eserleri yakında paylaşılacak.';
    message.dataset.en = 'Exhibition artworks will be shared soon.';
    container.append(message);
    return;
  }
  let current = [];
  const slots = [];
  for (let index = 0; index < Math.min(3, artworks.length); index++) {
    const card = document.createElement('a');
    card.className = 'exhibition-preview-card text-card';
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 400;
    image.height = 300;
    const title = document.createElement('h3');
    card.append(image, title);
    const artist = document.createElement('p');
    artist.className = 'exhibition-preview-artist';
    card.append(artist);
    container.append(card);
    slots.push({ card, image, title, artist });
  }

  function updateLabels() {
    const comingSoon = document.documentElement.lang === 'en' ? 'Image coming soon' : 'Görsel yakında';
    slots.forEach(({ image }, index) => {
      const artwork = current[index];
      image.alt = artwork.thumbnail ? artwork.title : `${artwork.title} — ${comingSoon}`;
    });
  }

  function rotate() {
    current = selectPreviewArtworks(artworks, current.map(artwork => artwork.id));
    slots.forEach(({ card, image, title, artist }, index) => {
      const artwork = current[index];
      card.href = `/exhibition.html#${artwork.id}`;
      image.src = artwork.thumbnail;
      title.textContent = artwork.title;
      artist.textContent = artwork.artist;
      artist.hidden = !artwork.artist || artwork.artist === artwork.title;
    });
    updateLabels();
  }

  rotate();
  document.addEventListener('languagechange', updateLabels);

  if (artworks.length > slots.length) {
    let hovered = false;
    let interactingUntil = 0;
    container.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; });
    container.addEventListener('pointerleave', () => { hovered = false; });
    container.addEventListener('pointerdown', () => { interactingUntil = Date.now() + rotationInterval; });
    container.addEventListener('scroll', () => { interactingUntil = Date.now() + rotationInterval; }, { passive: true });
    window.setInterval(() => {
      if (document.hidden || hovered || container.contains(document.activeElement) || Date.now() < interactingUntil) return;
      rotate();
    }, rotationInterval);
  }
}
