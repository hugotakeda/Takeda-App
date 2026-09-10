let currentTranslations = {};

export async function initI18n() {
  let locale = 'pt-BR';
  try {
    if (window.pulso && window.pulso.getLocale) {
      locale = await window.pulso.getLocale();
    }
  } catch (err) {
    console.warn('[i18n] Não foi possível detectar o idioma; usando pt-BR.', err);
  }

  const requestedLang = locale && !String(locale).toLowerCase().startsWith('pt') ? 'en' : 'pt';
  const candidates = requestedLang === 'pt' ? ['pt'] : ['en', 'pt'];

  for (const lang of candidates) {
    try {
      const response = await fetch(`./locales/${lang}.json`);
      if (!response.ok) continue;
      currentTranslations = await response.json();
      return;
    } catch (err) {
      console.warn(`[i18n] Falha ao carregar locales/${lang}.json.`, err);
    }
  }

  currentTranslations = {};
}

export function t(key) {
  return currentTranslations[key] || key;
}
