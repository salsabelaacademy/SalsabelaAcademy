import { createContext, useContext, useEffect, ReactNode } from "react";
import { Router } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import i18n from "@/lib/i18n";
type Language = "en" | "ar";
const LanguageContext = createContext<
  | {
      language: Language;
      setLanguage: (lang: Language) => void;
      isRTL: boolean;
    }
  | undefined
>(undefined);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [path, navigate] = useBrowserLocation();
  const language: Language = /^\/ar(?:\/|$)/.test(path) ? "ar" : "en";
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  function setLanguage(lang: Language) {
    const plain = path.replace(/^\/ar(?=\/|$)/, "") || "/";
    navigate(
      (lang === "ar" ? "/ar" + (plain === "/" ? "" : plain) : plain) +
        window.location.search +
        window.location.hash,
    );
  }
  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, isRTL: language === "ar" }}
    >
      <Router base={language === "ar" ? "/ar" : ""}>{children}</Router>
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("LanguageProvider required");
  return ctx;
}

export function ServerLanguageProvider({language,children}:{language: Language;children: ReactNode}) { return <LanguageContext.Provider value={{language,isRTL:language==="ar",setLanguage:()=>{}}}>{children}</LanguageContext.Provider>; }
