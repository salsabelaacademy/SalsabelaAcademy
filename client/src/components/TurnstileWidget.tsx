import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void }; } }
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(fail, 15000);
    function fail() { window.clearTimeout(timer); script.remove(); reject(new Error('Unable to load Turnstile')); }
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true;
    script.onload = () => { if (!window.turnstile) { fail(); return; } window.clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}
export function useTurnstileConfig() {
  const [config, setConfig] = useState<{ enabled: boolean; siteKey?: string; developmentBypass?: boolean } | null>(null);
  useEffect(() => { fetch('/api/auth/config', { credentials: 'include' }).then(r => { if (!r.ok) throw Error('config'); return r.json(); }).then(setConfig).catch(() => setConfig({ enabled: false, developmentBypass: false })); }, []);
  return config;
}
export default function TurnstileWidget({ siteKey, onToken, onError }: { siteKey?: string; onToken: (token: string) => void; onError?: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null), id = useRef<string>();
  const tokenCallback = useRef(onToken), errorCallback = useRef(onError);
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  tokenCallback.current = onToken; errorCallback.current = onError;
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let active = true;
    const fail = () => { if (active) { setFailed(true); tokenCallback.current(''); errorCallback.current?.(); } };
    loadScript().then(() => {
      if (active && window.turnstile && ref.current) id.current = window.turnstile.render(ref.current, {
        sitekey: siteKey, size: 'compact', language: document.documentElement.lang === 'ar' ? 'ar' : 'en',
        callback: (token: string) => { setFailed(false); tokenCallback.current(token); },
        'error-callback': fail, 'expired-callback': () => tokenCallback.current(''),
      });
    }).catch(fail);
    return () => { active = false; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = undefined; };
  }, [siteKey, attempt]);
  return <div><div ref={ref} className="min-h-3" />{failed && <div role="alert" className="p4-error"><p>{t('reviewFix.securityRetry')}</p><button type="button" className="p4-button" onClick={() => {setFailed(false); tokenCallback.current(''); setAttempt(v => v+1);}}>{t('p4.retry')}</button></div>}</div>;
}
