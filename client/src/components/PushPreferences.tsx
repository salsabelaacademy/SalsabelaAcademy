import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language';
export function PushPreferences() {
 const {t}=useTranslation(), {language}=useLanguage();
 const [configured,setConfigured]=useState<boolean|null>(null),[key,setKey]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const supported=typeof window!=='undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
 useEffect(()=>{let live=true;fetch('/api/push/config',{credentials:'include'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(async config=>{if(!live)return;setConfigured(config.configured);setKey(config.publicKey || '');if(supported){const registration=await navigator.serviceWorker.getRegistration('/');const sub=await registration?.pushManager.getSubscription();if(sub && config.configured){const result=await fetch('/api/push/subscriptions/status',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});if(!result.ok)throw new Error();const status=await result.json();if(live)setEnabled(status.subscribed);}}}).catch(()=>{if(live)setMessage('failed');});return()=>{live=false;};},[supported]);
 async function toggle(){
  if(busy)return;setBusy(true);setMessage('');
  try {
   const registration=await navigator.serviceWorker.register('/push-sw.js');await navigator.serviceWorker.ready;
   let sub=await registration.pushManager.getSubscription();
   if(enabled && sub){const r=await fetch('/api/push/subscriptions',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});if(!r.ok)throw new Error();await sub.unsubscribe();setEnabled(false);setMessage('disabled');}
   else {
    const permission=await Notification.requestPermission();if(permission!=='granted'){setMessage('denied');return;}
    const binary=atob(key.replace(/-/g,'+').replace(/_/g,'/'));const applicationServerKey=Uint8Array.from(binary,c=>c.charCodeAt(0));
    sub=sub || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
    const value=sub.toJSON();const r=await fetch('/api/push/subscriptions',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:value.endpoint,keys:value.keys,language})});if(!r.ok)throw new Error();setEnabled(true);setMessage('enabled');
   }
  }catch{setMessage('failed');}finally{setBusy(false);}
 }
 return <section className="dash-panel push-preferences"><h2>{t('experience.pushTitle')}</h2><p>{t('experience.pushBody')}</p><p className="text-sm">{t('experience.pushPrivacy')}</p><button type="button" className="p4-button" disabled={!supported || !configured || busy} onClick={()=>void toggle()}>{t('experience.'+(busy?'working':enabled?'disablePush':'enablePush'))}</button><p role="status">{t('experience.'+(!supported?'unsupported':message || (configured===null?'working':!configured?'notConfigured':enabled?'enabled':'ready')))}</p><small>{t('experience.iphone')}</small></section>;
}
