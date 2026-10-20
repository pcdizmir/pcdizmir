export function initializeLanguageToggle() {
  const toggle = document.getElementById('language-toggle');
  if (!toggle) return;

  // Keep the authored Turkish content so switching back preserves every label.
  const translations = [...document.querySelectorAll('[data-en], [data-en-aria-label], [data-en-alt]')].map(element => ({
    element,
    text: element.hasAttribute('data-en') ? element.textContent : null,
    label: element.getAttribute('aria-label'),
    alt: element.getAttribute('alt'),
  }));
  let language = 'tr';

  function applyLanguage(nextLanguage) {
    language = nextLanguage === 'en' ? 'en' : 'tr';
    const english = language === 'en';
    document.documentElement.lang = language;
    for (const { element, text, label, alt } of translations) {
      if (text !== null) element.textContent = english ? element.dataset.en : text;
      if (element.hasAttribute('data-en-aria-label')) {
        element.setAttribute('aria-label', english ? element.dataset.enAriaLabel : label);
      }
      if (element.hasAttribute('data-en-alt')) {
        element.setAttribute('alt', english ? element.dataset.enAlt : alt);
      }
    }
    toggle.setAttribute('aria-pressed', String(english));
    toggle.setAttribute('aria-label', english ? 'Türkçeye geç' : 'Switch to English');
    toggle.querySelectorAll('[data-language]').forEach(label => {
      label.classList.toggle('is-active', label.dataset.language === language);
    });
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
  }

  try {
    language = localStorage.getItem('pcd-izmir-language') === 'en' ? 'en' : 'tr';
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
  applyLanguage(language);
  toggle.addEventListener('click', () => {
    applyLanguage(language === 'tr' ? 'en' : 'tr');
    try {
      localStorage.setItem('pcd-izmir-language', language);
    } catch {
      // Keep the chosen language for this page even without storage access.
    }
  });
}
