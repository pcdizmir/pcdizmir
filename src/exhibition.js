import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import './style.css';
import './exhibition.css';
import artworks from 'virtual:exhibition-artworks';
import { initializeLanguageToggle } from './language.js';
import { artworkIndexForHash } from './exhibition-links.js';

function translated(tag, turkish, english, className) {
  const element = document.createElement(tag);
  element.textContent = turkish;
  element.dataset.en = english;
  if (className) element.className = className;
  return element;
}

function artworkSlide(artwork, index) {
  const slide = document.createElement('article');
  slide.className = 'swiper-slide artwork-slide';
  // Route the URL ourselves so native anchor scrolling cannot shift Swiper sideways.
  slide.id = `exhibition-work-${artwork.id}`;
  slide.setAttribute('aria-labelledby', `artwork-${index}`);
  slide.setAttribute('role', 'group');

  const image = document.createElement('img');
  image.className = 'artwork-thumbnail';
  if (artwork.thumbnail) image.src = artwork.thumbnail;
  image.alt = `${artwork.title} — ${artwork.artist}`;
  if (!artwork.thumbnail) {
    image.alt = `${artwork.title} — Görsel yakında`;
    image.dataset.enAlt = `${artwork.title} — Image coming soon`;
  }
  image.loading = index === 0 ? 'eager' : 'lazy';
  image.decoding = 'async';
  const missing = translated('p', 'Görsel yakında.', 'Image coming soon.', 'artwork-image-missing');
  image.hidden = !artwork.thumbnail;
  missing.hidden = Boolean(artwork.thumbnail);
  image.addEventListener('error', () => {
    image.hidden = true;
    missing.textContent = document.documentElement.lang === 'en' ? 'Image unavailable.' : 'Görsel yüklenemedi.';
    missing.hidden = false;
  });
  slide.append(image, missing);

  const content = document.createElement('div');
  content.className = 'text-card artwork-content';
  const title = document.createElement('h2');
  title.id = `artwork-${index}`;
  title.textContent = artwork.title;
  const artist = artwork.artist
    ? document.createElement('p')
    : translated('p', 'Sanatçı bilgisi paylaşılmadı.', 'Artist information not provided.');
  artist.className = 'artwork-artist';
  if (artwork.artist) artist.textContent = artwork.artist;
  artist.hidden = artwork.artist === artwork.title;
  content.append(title, artist);

  const details = document.createElement('details');
  details.className = 'artwork-details swiper-no-swiping';
  details.append(translated('summary', 'Eser bilgisi', 'Artwork details'));
  if (artwork.year || artwork.medium) {
    const metadata = translated('p',
      [artwork.year, artwork.mediumTr].filter(Boolean).join(' · '),
      [artwork.year, artwork.mediumEn].filter(Boolean).join(' · '),
      'artwork-metadata');
    details.append(metadata);
  }
  if (artwork.descriptionTr) {
    details.append(translated('h3', 'Eser hakkında', 'About the artwork'));
    details.append(translated('p', artwork.descriptionTr, artwork.descriptionEn, 'artwork-prose'));
  }
  if (artwork.bioTr) {
    details.append(translated('h3', 'Sanatçı hakkında', 'About the artist'));
    details.append(translated('p', artwork.bioTr, artwork.bioEn, 'artwork-prose'));
  }
  if (artwork.algorithmsTr) {
    details.append(translated('h3', 'Algoritmalar ve kurallar', 'Algorithms and rules'));
    details.append(translated('p', artwork.algorithmsTr, artwork.algorithmsEn, 'artwork-prose'));
  }
  if (artwork.projectLinks.length) {
    details.append(translated('h3', 'Proje bağlantıları', 'Project links'));
    const links = document.createElement('ul');
    links.className = 'artwork-project-links';
    artwork.projectLinks.forEach(url => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      links.append(item);
    });
    details.append(links);
  }
  if (artwork.artistUrl) {
    const link = translated('a', 'Sanatçının web sitesi', 'Artist website');
    link.href = artwork.artistUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    details.append(link);
  }
  if (details.children.length > 1) content.append(details);
  slide.append(content);
  return slide;
}

const status = document.getElementById('exhibition-status');
const gallery = document.getElementById('exhibition-gallery');
const controls = gallery.querySelector('.exhibition-controls');
const arrows = gallery.querySelector('.exhibition-arrows');
const slides = document.getElementById('artwork-slides');
const pagination = gallery.querySelector('.exhibition-pagination');
try {
  artworks.forEach((artwork, index) => {
    slides.append(artworkSlide(artwork, index));
    const button = translated('button', String(index + 1), String(index + 1));
    button.type = 'button';
    button.setAttribute('aria-label', `Eser ${index + 1}: ${artwork.title}`);
    button.dataset.enAriaLabel = `Artwork ${index + 1}: ${artwork.title}`;
    pagination.append(button);
  });
  gallery.hidden = artworks.length === 0;
  status.hidden = artworks.length > 0;
  controls.hidden = artworks.length < 2;
  arrows.hidden = artworks.length < 2;
} catch (error) {
  console.error('Exhibition content:', error);
  status.textContent = 'Sergi şu anda görüntülenemiyor. Lütfen daha sonra tekrar deneyin.';
  status.dataset.en = 'The exhibition is currently unavailable. Please try again later.';
}

// Capture all generated translations before the language toggle stores its labels.
initializeLanguageToggle();

if (artworks.length) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buttons = [...pagination.querySelectorAll('button')];
  const carousel = gallery.querySelector('.exhibition-carousel');
  const swiper = new Swiper(carousel, {
    modules: [Navigation],
    slidesPerView: 1,
    centeredSlides: false,
    spaceBetween: 0,
    autoHeight: true,
    loop: false,
    speed: reducedMotion ? 0 : 300,
    watchOverflow: true,
    navigation: {
      prevEl: gallery.querySelector('.exhibition-previous'),
      nextEl: gallery.querySelector('.exhibition-next'),
    },
    on: {
      slideChange(swiper) {
        slides.querySelectorAll('details[open]').forEach(details => { details.open = false; });
        buttons.forEach((button, index) => {
          if (index === swiper.activeIndex) button.setAttribute('aria-current', 'true');
          else button.removeAttribute('aria-current');
        });
        [...slides.children].forEach((slide, index) => { slide.inert = index !== swiper.activeIndex; });
      },
    },
  });
  buttons[0].setAttribute('aria-current', 'true');
  [...slides.children].forEach((slide, index) => { slide.inert = index !== 0; });
  buttons.forEach((button, index) => button.addEventListener('click', () => swiper.slideTo(index)));
  slides.querySelectorAll('details').forEach(details => {
    details.addEventListener('toggle', () => requestAnimationFrame(() => swiper.updateAutoHeight()));
  });
  slides.querySelectorAll('img').forEach(image => {
    image.addEventListener('load', () => swiper.updateAutoHeight());
    image.addEventListener('error', () => swiper.updateAutoHeight());
  });
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.defaultPrevented || !(event.target instanceof Element)) return;
    if (event.target.closest('a, button, input, textarea, select, summary, .artwork-content, .site-header, .exhibition-arrows, .exhibition-controls')) return;
    const image = slides.children[swiper.activeIndex]?.querySelector('.artwork-thumbnail');
    if (!image || image.hidden) return;
    const { top, bottom, left, width } = image.getBoundingClientRect();
    if (event.clientY < top || event.clientY > bottom) return;
    if (event.clientX < left + width / 2) swiper.slidePrev();
    else swiper.slideNext();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.key === 'ArrowRight') swiper.slideNext();
    else swiper.slidePrev();
  });
  document.getElementById('language-toggle').addEventListener('click', () => {
    requestAnimationFrame(() => swiper.updateAutoHeight());
  });
  document.fonts.ready.then(() => swiper.updateAutoHeight());

  function openLinkedArtwork() {
    const index = artworkIndexForHash(artworks, window.location.hash);
    if (index < 0) return;
    swiper.slideTo(index, 0);
    const details = slides.children[index].querySelector('details');
    if (details) details.open = true;
    requestAnimationFrame(() => {
      swiper.updateAutoHeight();
      gallery.scrollIntoView({ behavior: 'instant', block: 'start' });
      (details?.querySelector('summary') || carousel).focus({ preventScroll: true });
    });
  }

  window.addEventListener('hashchange', openLinkedArtwork);
  openLinkedArtwork();
}
