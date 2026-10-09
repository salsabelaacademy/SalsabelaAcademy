import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, X, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationFeed } from "./NotificationFeed";
import { PushPreferences } from "./PushPreferences";
export function NotificationInbox({open,onOpenChange,unread,items,date,onDone}:{open:boolean;onOpenChange:(value:boolean)=>void;unread:number;items:any[];date:(value:string)=>string;onDone:()=>void}) {
 const {t,i18n}=useTranslation();const [settings,setSettings]=useState(false);
 return <Dialog.Root open={open} onOpenChange={value=>{onOpenChange(value);if(!value)setSettings(false);}}>
  <Dialog.Trigger asChild><button type="button" className="dash-notifications" aria-label={t('p4.notifications')}><Bell size={20} aria-hidden/>{unread>0&&<span/>}</button></Dialog.Trigger>
  <Dialog.Portal><Dialog.Overlay className="communication-overlay notification-overlay"/><Dialog.Content className="academy-notification-inbox" dir={i18n.language.startsWith('ar')?'rtl':'ltr'}>
   <header className="notification-inbox-brand"><Bell size={23} aria-hidden/><div><Dialog.Title>{t('p4.notifications')}</Dialog.Title><Dialog.Description>{t('communication.notificationHint')}</Dialog.Description></div><button type="button" aria-label={t('communication.pushSettings')} aria-expanded={settings} onClick={()=>setSettings(v=>!v)}><Settings2 size={20}/></button><Dialog.Close aria-label={t('p4.close')}><X size={21}/></Dialog.Close></header>
   <div className="notification-inbox-content">{settings?<div className="notification-push-panel"><PushPreferences/></div>:<NotificationFeed items={items} date={date} onDone={onDone}/>}</div>
  </Dialog.Content></Dialog.Portal>
 </Dialog.Root>;
}
