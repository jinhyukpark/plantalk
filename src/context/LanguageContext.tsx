import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLanguage, Nationality, TranslationKey, translations } from '../i18n/translations';
import { useApp } from './AppContext';

interface LanguageContextValue {
  language: AppLanguage;
  nationality: Nationality;
  setPreviewNationality: (nationality: Nationality) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const detectNationality = (): Nationality => {
  const locale = getLocales()[0];
  if (locale?.regionCode === 'KR' || locale?.languageCode === 'ko') return 'KR';
  if (locale?.regionCode === 'JP' || locale?.languageCode === 'ja') return 'JP';
  return 'OTHER';
};

const languageFor = (nationality: Nationality): AppLanguage =>
  nationality === 'KR' ? 'ko' : nationality === 'JP' ? 'ja' : 'en';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const PREVIEW_NATIONALITY_KEY = '@plantalk/preview-nationality';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [previewNationality, setPreviewNationality] = useState<Nationality>(detectNationality);
  const nationality = (user?.nationality as Nationality | undefined) || previewNationality;
  const language = languageFor(nationality);

  const updatePreviewNationality = useCallback((nextNationality: Nationality) => {
    setPreviewNationality(nextNationality);
    void AsyncStorage.setItem(PREVIEW_NATIONALITY_KEY, nextNationality);
  }, []);

  useEffect(() => {
    if (user) return;
    let active = true;
    void AsyncStorage.getItem(PREVIEW_NATIONALITY_KEY).then(saved => {
      if (active && (saved === 'KR' || saved === 'JP' || saved === 'OTHER')) {
        setPreviewNationality(saved);
      }
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (user?.nationality) updatePreviewNationality(user.nationality as Nationality);
  }, [updatePreviewNationality, user?.nationality]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    nationality,
    setPreviewNationality: updatePreviewNationality,
    t: (key, params) => {
      let value = translations[language][key] || translations.ko[key] || key;
      Object.entries(params || {}).forEach(([name, replacement]) => {
        value = value.replace(`{{${name}}}`, replacement);
      });
      return value;
    },
  }), [language, nationality, updatePreviewNationality]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
