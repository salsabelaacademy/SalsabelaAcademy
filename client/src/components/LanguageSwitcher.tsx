import { useCallback, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useTranslation } from "react-i18next";
import { Languages, ChevronDown, Check } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
export function LanguageSwitcher({ onBeforeChange, mobileTransition = false }: { onBeforeChange?: () => void; mobileTransition?: boolean } = {}) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  // Keep nested menu inside the mobile dialog's focus and pointer boundary.
  const [container, setContainer] = useState<HTMLElement>();
  const attachTrigger = useCallback((node: HTMLButtonElement | null) => {
    if (node) setContainer(node.closest<HTMLElement>('[role="dialog"]') || undefined);
  }, []);
  return (
    <Dropdown.Root modal={false} dir={language==='ar'?'rtl':'ltr'}><Dropdown.Trigger asChild><button
      ref={attachTrigger}
      type="button"
      className="p4-control academy-language-toggle"
      aria-label={t("p4.language")}
      title={t('lessonMail.language')}
    >
      <Languages size={17} aria-hidden="true" />
      <span lang={language}>{t(language==='ar'?'p4.arabic':'p4.english',{lng:language})}</span><ChevronDown size={14} aria-hidden="true" />
    </button></Dropdown.Trigger><Dropdown.Portal container={container}><Dropdown.Content className="academy-language-menu" align="end" sideOffset={10} collisionPadding={12}>
      <Dropdown.Label>{t('lessonMail.language')}</Dropdown.Label>
      <Dropdown.RadioGroup value={language} onValueChange={value=>{if(value===language || !['en','ar'].includes(value))return;onBeforeChange?.();if(mobileTransition&&matchMedia('(max-width:767px)').matches)window.dispatchEvent(new Event('academy:mobile-language'));setLanguage(value as 'en'|'ar');}}>
        {(['en','ar'] as const).map(value=><Dropdown.RadioItem key={value} value={value}><span lang={value} dir={value==='ar'?'rtl':'ltr'}>{t(value==='ar'?'p4.arabic':'p4.english',{lng:value})}</span><Dropdown.ItemIndicator><Check size={17} aria-hidden="true" /></Dropdown.ItemIndicator></Dropdown.RadioItem>)}
      </Dropdown.RadioGroup>
    </Dropdown.Content></Dropdown.Portal></Dropdown.Root>
  );
}
