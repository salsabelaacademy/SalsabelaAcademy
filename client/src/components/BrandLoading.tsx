import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Only real pending operations lasting over 300ms display the logo. */
export function BrandLoading({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setVisible(true), 300); return () => clearTimeout(timer); }, []);
  return <div className={`brand-loading${compact ? ' is-compact' : ''}`} aria-busy="true">{visible && <div className="brand-loading-content" role="status" aria-live="polite"><img src="/logo-icon.png" width="64" height="64" alt="" /><p>{t("pageUi.BrandLoading.Loading")}</p></div>}</div>;
}

/** Cached tabs and language switches need no simulated waiting screen. */
export function ContentTransition({ identity, children }: { identity: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = root.current?.animate([{ opacity: .85 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [identity]);
  return <div ref={root} className="workspace-transition">{children}</div>;
}
