import { useLanguage } from "@/hooks/use-language";
import { useTranslation } from "react-i18next";
import { Languages } from 'lucide-react';
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="p4-control academy-language-toggle"
      aria-label={t("p4.language")}
      title={t(language === 'ar' ? 'p4.english' : 'p4.arabic')}
      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
    >
      <Languages size={17} aria-hidden="true" />
      <span lang={language === 'ar' ? 'en' : 'ar'}>{t(language === "ar" ? "p4.english" : "p4.arabic")}</span>
    </button>
  );
}
