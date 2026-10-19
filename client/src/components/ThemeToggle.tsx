import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
export function ThemeToggle() {
  const {isDark,toggleTheme}=useTheme();const {t}=useTranslation();
  return <button type="button" className="academy-theme-toggle" aria-pressed={isDark} aria-label={t(isDark?'lessonMail.light':'lessonMail.dark')} title={t(isDark?'lessonMail.light':'lessonMail.dark')} onClick={toggleTheme}>
    <span className={isDark?'theme-orbit theme-orbit-dark':'theme-orbit'} aria-hidden="true">{isDark?<Moon size={19}/>:<Sun size={19}/>}</span>
  </button>;
}
