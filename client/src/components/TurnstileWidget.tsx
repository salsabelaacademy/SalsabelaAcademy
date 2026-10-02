import { useEffect, useRef, useState } from "react";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void }; } }
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error("Unable to load Turnstile")); document.head.appendChild(script);
  });
  return scriptPromise;
}
export function useTurnstileConfig() {
  const [config, setConfig] = useState<{ enabled: boolean; siteKey?: string; developmentBypass?: boolean } | null>(null);
  useEffect(() => { fetch("/api/auth/config", { credentials: "include" }).then(r => r.json()).then(setConfig).catch(() => setConfig({ enabled: false, developmentBypass: false })); }, []);
  return config;
}
export default function TurnstileWidget({ siteKey, onToken, onError }: { siteKey?: string; onToken: (token: string) => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const id = useRef<string>();
  const tokenCallback = useRef(onToken); const errorCallback = useRef(onError);
  tokenCallback.current = onToken; errorCallback.current = onError;
  useEffect(() => { if (!siteKey || !ref.current) return; let active = true; loadScript().then(() => { if (active && window.turnstile && ref.current) id.current = window.turnstile.render(ref.current, { sitekey: siteKey, size: "compact", language: document.documentElement.lang === "ar" ? "ar" : "en", callback: (token: string) => tokenCallback.current(token), "error-callback": () => errorCallback.current?.(), "expired-callback": () => tokenCallback.current("") }); }).catch(() => { if (active) errorCallback.current?.(); }); return () => { active = false; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = undefined; }; }, [siteKey]);
  return <div ref={ref} className="min-h-3" />;
}
