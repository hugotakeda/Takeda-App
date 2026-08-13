let currentTranslations = {};

export async function initI18n() {
  try {
    let locale = 'en-US';
    if (window.pulso && window.pulso.getLocale) {
      locale = await window.pulso.getLocale();
    }
    
    let lang = 'en';
    if (locale && locale.toLowerCase() === 'pt-br') {
      lang = 'pt';
    }
    
    const response = await fetch(`./locales/${lang}.json`);
    if (response.ok) {
      currentTranslations = await response.json();
    } else {
      console.warn(`Could not load locales/${lang}.json`);
    }
  } catch (err) {
    console.error("i18n init error:", err);
  }
}

export function t(key) {
  return currentTranslations[key] || key;
}
