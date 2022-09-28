import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';

const lng = 'en';
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: { en, zh },
    lng,
    fallbackLng: lng,

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
