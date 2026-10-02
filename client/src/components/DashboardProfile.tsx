import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PushPreferences } from './PushPreferences';
import { AccountAvatar } from './AccountAvatar';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

export function DashboardProfile({ onSaved }: { onSaved: () => void }) {
  const { user, refreshUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const tr = (key: string) => t('p4.' + key);
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  async function changeAvatar(file?: File) {
    if (imageBusy) return;
    setImageBusy(true); setImageMessage('');
    let bitmap: ImageBitmap | undefined;
    try {
      let encoded: string | undefined;
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('avatarInvalid');
        bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 384;
        const context = canvas.getContext('2d'); if (!context) throw new Error('avatarInvalid');
        const side = Math.min(bitmap.width, bitmap.height);
        context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 384, 384);
        encoded = canvas.toDataURL('image/webp', 0.82);
        if (encoded.length > 240000) throw new Error('avatarInvalid');
      }
      const response = await fetch('/api/portal/avatar', { method: file ? 'PUT' : 'DELETE', credentials: 'include', ...(file ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: encoded }) } : {}) });
      if (!response.ok) throw new Error(response.status === 429 ? 'limited' : response.status === 400 ? 'avatarInvalid' : 'failed');
      await refreshUser(); setImageMessage('saved');
    } catch (error) { setImageMessage(error instanceof Error && ['avatarInvalid', 'limited', 'failed'].includes(error.message) ? error.message : 'avatarInvalid'); }
    finally { bitmap?.close(); setImageBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/portal/account', { credentials: 'include', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then(setAccount).catch(e => { if (e.name !== 'AbortError') setError('failed'); });
    return () => controller.abort();
  }, [revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/portal/account', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error(response.status === 400 ? 'profileInvalid' : 'failed');
      await refreshUser();
      onSaved(); setSaved(true);
      if (values.preferredLanguage) setLanguage(values.preferredLanguage as 'ar' | 'en');
    } catch (e) { setError(e instanceof Error ? e.message : 'failed'); }
    finally { setBusy(false); }
  }
  return <section className="dash-profile-page">
    <div className="dash-profile-banner"><span className="dash-profile-portrait"><AccountAvatar user={user} /></span><div><p>{tr('profile')}</p><h2>{user?.name}</h2><bdi>{user?.email}</bdi></div><span className="dash-profile-role"><ShieldCheck size={18} aria-hidden="true" />{tr(user?.role === 'admin' ? 'adminRole' : 'studentRole')}</span></div>
    <p>{t('experience.profileIntro')}</p><section className="dash-panel dash-language-settings"><div><h2>{t('workspace.interfaceLanguage')}</h2><p>{t('workspace.languageHint')}</p></div><LanguageSwitcher /></section>
    {account && <section className="dash-panel"><h2>{t('experience.accountSummary')}</h2><dl className="profile-summary">{[['status',tr('states.'+account.status)],['joined',account.created_at ? new Intl.DateTimeFormat(language,{dateStyle:'medium'}).format(new Date(account.created_at)) : '—'],['lastLogin',account.last_login_at ? new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(account.last_login_at)) : '—']].map(([key,value])=><div key={key}><dt>{t('experience.'+key)}</dt><dd>{value}</dd></div>)}<div><dt>{tr('email')}</dt><dd>{t('experience.'+(account.email_verified_at?'verified':'unverified'))}</dd></div></dl></section>}
    <section className="dash-panel dash-photo-settings"><div><h2>{tr('profilePhoto')}</h2><p>{tr('avatarHint')}</p></div><div className="p4-row"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label={tr('changePhoto')} hidden onChange={e => { const file = e.target.files?.[0]; if (file) void changeAvatar(file); }} /><button className="p4-button" disabled={imageBusy} onClick={() => fileInput.current?.click()}>{tr(imageBusy ? 'sending' : 'changePhoto')}</button>{user?.avatarUrl && <button className="p4-control" disabled={imageBusy} onClick={() => void changeAvatar()}>{tr('removePhoto')}</button>}</div>{imageMessage && <p role={imageMessage === 'saved' ? 'status' : 'alert'}>{tr(imageMessage)}</p>}</section>
    <div className="dash-panel"><h2><UserRound size={21} aria-hidden="true" /> {tr('personalDetails')}</h2>
      {!account && !error && <p role="status">{tr('loading')}</p>}
      {account && <form onSubmit={submit} className="dash-profile-form">
        <label>{tr('name')}<input name="name" defaultValue={account.name} autoComplete="name" minLength={2} maxLength={200} required /></label>
        <label>{tr('email')}<input value={account.email} readOnly type="email" aria-describedby="profile-email-hint" dir="ltr" /><small id="profile-email-hint">{tr('profileEmailHint')}</small></label>
        {user?.role === 'student' && <>
          <label>{tr('phone')}<input name="phone" type="tel" defaultValue={account.phone || ''} autoComplete="tel" maxLength={30} /></label>
          <label>{tr('country')}<input name="country" defaultValue={account.country || ''} autoComplete="country-name" maxLength={100} /></label>
          <label>{tr('timezone')}<select name="timezone" defaultValue={account.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} dir="ltr" required>{Array.from(new Set([account.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,...((Intl as any).supportedValuesOf?.('timeZone') || ['UTC','Africa/Cairo'])])).map(zone=><option key={String(zone)} value={String(zone)}>{String(zone)}</option>)}</select><small>{tr('timezoneExample')}</small></label>
          <label>{tr('preferredLanguage')}<select name="preferredLanguage" defaultValue={account.preferred_language === 'ar' ? 'ar' : account.preferred_language === 'en' ? 'en' : language}><option value="ar">{tr('arabic')}</option><option value="en">{tr('english')}</option></select></label>
        </>}
        <div className="dash-profile-save"><button className="p4-button" disabled={busy}>{tr(busy ? 'sending' : 'save')}</button>{saved && <p role="status">{tr('saved')}</p>}</div>
      </form>}
      {error && <p role="alert">{tr(error)}</p>}{!account && error && <button className="p4-button" onClick={() => setRevision(v => v + 1)}>{tr('retry')}</button>}
    </div>
    <PushPreferences />
    <div className="dash-panel"><h2>{tr('accountSecurity')}</h2><p>{tr('profileSecurityHint')}</p><Link className="p4-button" href="/account/password">{tr('password')}</Link></div>
  </section>;
}
