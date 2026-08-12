import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UI_LANGUAGES, t as translate, type UiLanguage } from "@/lib/i18n";

const STORAGE_KEY = "clinic:ui-language";

function normalize(value: string | null | undefined): UiLanguage {
  return (UI_LANGUAGES as readonly string[]).includes(value ?? "") ? (value as UiLanguage) : "English";
}

type LangState = {
  lang: UiLanguage;
  setLang: (next: string) => void;
  t: (key: string) => string;
};

const LangContext = createContext<LangState>({
  lang: "English",
  setLang: () => {},
  t: (key) => translate("English", key as never),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [lang, setLangState] = useState<UiLanguage>("English");
  const [touched, setTouched] = useState(false);

  // Restore local preference after hydration (avoids SSR mismatch).
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setLangState(normalize(stored));
      setTouched(true);
    }
  }, []);

  // Fall back to the saved profile language when the user hasn't picked one locally.
  useEffect(() => {
    if (touched || !profile) return;
    setLangState(normalize(profile.ui_language));
  }, [profile, touched]);

  const setLang = useCallback(
    (next: string) => {
      const value = normalize(next);
      setLangState(value);
      setTouched(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* storage unavailable */
      }
      if (profile) {
        void supabase.from("profiles").update({ ui_language: value }).eq("id", profile.id);
      }
    },
    [profile],
  );

  const value = useMemo<LangState>(
    () => ({ lang, setLang, t: (key: string) => translate(lang, key as never) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
