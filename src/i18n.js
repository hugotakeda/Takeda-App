let currentTranslations = {};

export async function initI18n() {
  try {
    let locale = 'en-US';
    if (window.pulso && window.pulso.getLocale) {
      locale = await window.pulso.getLocale();
    }
    
    // O app é majoritariamente hardcoded em pt-BR, então o padrão é português;
    // só cai para inglês se o locale do sistema for claramente outro idioma.
    let lang = 'pt';
    if (locale && !locale.toLowerCase().startsWith('pt')) {
      lang = 'en';
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
