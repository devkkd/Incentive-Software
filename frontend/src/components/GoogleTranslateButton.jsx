'use client';

import { useEffect } from 'react';
import { useLang } from '@/context/LanguageContext';

function triggerGoogleTranslate(langCode) {
  const attempt = (tries = 0) => {
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = langCode === 'en' ? '' : langCode;
      select.dispatchEvent(new Event('change'));
    } else if (tries < 30) {
      setTimeout(() => attempt(tries + 1), 300);
    }
  };
  attempt();
}

export default function GoogleTranslateButton() {
  const { lang, switchLang } = useLang();

  // Re-apply saved language after page load / navigation
  useEffect(() => {
    if (lang === 'hi') {
      setTimeout(() => triggerGoogleTranslate('hi'), 800);
    }
  }, [lang]);

  const handleSwitch = (l) => {
    switchLang(l);
    if (l === 'en') {
      // Reload page to fully restore original English text
      // Remove Google Translate cookie first
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
      window.location.reload();
      return;
    }
    triggerGoogleTranslate(l);
  };

  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => handleSwitch('en')}
        className={`px-3 py-2 text-sm font-semibold transition-colors ${
          lang === 'en' ? 'bg-[#2B3B8A] text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        EN
      </button>
      <div className="w-px h-5 bg-gray-200" />
      <button
        onClick={() => handleSwitch('hi')}
        className={`px-3 py-2 text-sm font-semibold transition-colors ${
          lang === 'hi' ? 'bg-[#2B3B8A] text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        हिं
      </button>
    </div>
  );
}
