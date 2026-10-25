import { SmoothParticleSystem } from './smooth-particles.js';
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css/bundle';
import './style.css';
import { initializeLanguageToggle } from './language.js';
import { renderExhibitionPreview } from './exhibition-preview.js';
import { initializeEventCountdown } from './event-countdown.js';

document.addEventListener('DOMContentLoaded', () => {
  renderExhibitionPreview();
  initializeLanguageToggle();
  initializeEventCountdown();
  // 1. Initialize Smooth Eased Particle Background (Black-on-White, Low Kinetic Energy)
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const particles = new SmoothParticleSystem(canvas);
    
    function renderLoop() {
      particles.render();
      requestAnimationFrame(renderLoop);
    }
    renderLoop();
  }

  // 2. Site Header Scroll State
  const header = document.getElementById('site-header');
  if (header) {
    const handleHeaderScroll = () => {
      if (window.scrollY > 40) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    };
    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll();
  }

  // 3. Mobile Navigation Drawer
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileOverlay = document.getElementById('mobile-nav-overlay');
  
  if (mobileBtn && mobileOverlay) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = mobileOverlay.classList.toggle('is-open');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileOverlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // 4. Swiper Gallery Carousel
  const swiperEl = document.querySelector('.mySwiper');
  if (swiperEl) {
    new Swiper('.mySwiper', {
      modules: [Navigation, Pagination, Autoplay],
      centeredSlides: true,
      spaceBetween: 24,
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  }
});
