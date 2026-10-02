import { DashboardSearch, type SearchRecord } from './DashboardSearch';
import { LessonCompletion } from './LessonCompletion';
import {useLocation} from 'wouter';
import {Search,RefreshCw} from 'lucide-react';
import { AccountAvatar } from "./AccountAvatar";
import { useRef, useState, useEffect, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ClipboardList, Users, CalendarDays, BookOpen, CheckCheck, Mail, Bell, Inbox, History, Settings, GraduationCap, NotebookPen, Plug, FileText, Menu, X, LogOut, ArrowUpRight, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { DisplayControls } from './PublicShell';
import { StudentLiveResources } from '@/components/StudentLiveResources';
import './dashboard.css';

const icons: Record<string, LucideIcon> = { overview: LayoutDashboard, applications: ClipboardList, students: Users, lessons: CalendarDays, curriculum: BookOpen, attendance: CheckCheck, messages: Mail, notifications: Bell, contactInbox: Inbox, audit: History, settings: Settings, programs: GraduationCap, homework: NotebookPen, profile: UserRound };
type Notification = {id: number; title: string; body: string; created_at: string; read_at: string | null};
type ShellProps = { admin: boolean; user: AuthUser; tab: string; tabs: string[]; unread: number; onRefresh: () => void; refreshing: boolean; notifications: Notification[]; notificationDate: (value: string) => string; onRead: (id: number) => void; notificationBusy: boolean; notificationError: string; onTab: (key: string) => void; onRecord: (record: SearchRecord) => void; onLogout: () => void; children: ReactNode };
export function DashboardShell({ admin, user, tab, tabs, unread, notifications, notificationDate, onRead, notificationBusy, notificationError, onRefresh, refreshing, onTab, onRecord, onLogout, children }: ShellProps) {
  const { t } = useTranslation();
  const [,navigate]=useLocation();
  const tr = (key: string) => t('p4.' + key);
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const { language } = useLanguage();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('salsabela-sidebar-collapsed') === 'true'; } catch { return false; } });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setQuickOpen(value=>!value);}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[]);
  const quickKeys=[...tabs,...(admin?['integrations','blog']:[])];

  useEffect(() => { try { localStorage.setItem('salsabela-sidebar-collapsed', String(collapsed)); } catch { /* Private browsers can disable storage. */ } }, [collapsed]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = matchMedia('(min-width:901px)');
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener('change', closeOnDesktop);
    return () => { document.body.style.overflow = previous; media.removeEventListener('change', closeOnDesktop); };
  }, [drawerOpen]);
  const select = (key: string) => { if(key==='blog'||key==='integrations')navigate(key==='blog'?'/admin':'/admin/integrations');else onTab(key); dialog.current?.close(); setNotificationsOpen(false);setQuickOpen(false); };
  const importantNotifications = [...notifications].sort((a, b) => Number(!!a.read_at) - Number(!!b.read_at) || +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
  const navigation = <>
    <Link href="/" className="dash-brand"><img src="/logo-icon.png" width="48" height="48" alt={tr('brand')} /><span>{tr('brand')}<small>{tr(admin ? 'adminRole' : 'studentRole')}</small></span></Link>
    <p className="dash-nav-label">{tr('workspaceLabel')}</p>
    <nav aria-label={tr('menu')} className="dash-nav">{tabs.map(key => { const Icon = icons[key]; return <button type="button" key={key} title={tr(key)} aria-label={tr(key)} aria-current={tab === key ? 'page' : undefined} onClick={() => select(key)}><Icon size={19} aria-hidden="true" /><span>{tr(key)}</span>{key === 'notifications' && unread > 0 && <span className="dash-count">{unread}</span>}</button>; })}
      {admin && <><Link href="/admin/integrations" onClick={() => dialog.current?.close()} aria-current={tab === "integrations" ? "page" : undefined} title={tr('integrations')} aria-label={tr('integrations')}><Plug size={19} aria-hidden="true" /><span>{tr('integrations')}</span></Link><Link href="/admin" onClick={() => dialog.current?.close()} aria-current={tab === "blog" ? "page" : undefined} title={tr('blog')} aria-label={tr('blog')}><FileText size={19} aria-hidden="true" /><span>{tr('blog')}</span></Link></>}
    </nav>
    <div className="dash-account"><span className="dash-avatar"><AccountAvatar user={user} /></span><div><strong>{user.name}</strong><small>{tr(admin ? 'adminRole' : 'studentRole')}</small></div><button type="button" onClick={onLogout} aria-label={tr('signout')} title={tr('signout')}><LogOut size={19} aria-hidden="true" /></button></div>
  </>;
  return <div className={`dash-root${collapsed ? ' dash-collapsed' : ''}`}>
    <a className="p4-skip" href="#dashboard-content">{tr('skip')}</a>
    <aside id="dashboard-sidebar" className="dash-sidebar">{navigation}</aside>
    <dialog ref={dialog} aria-label={tr("menu")} className="dash-drawer" onClose={() => { setDrawerOpen(false); menu.current?.focus(); }} onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}><button type="button" className="dash-close" aria-label={tr('close')} onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button>{navigation}</dialog>
    <DashboardSearch open={quickOpen} onOpenChange={setQuickOpen} sections={quickKeys} onSection={select} onRecord={record=>{setQuickOpen(false);setNotificationsOpen(false);dialog.current?.close();onRecord(record);}} />
    <div className="dash-main"><header className="dash-topbar">
      <button type="button" className="dash-collapse-toggle" aria-label={tr(collapsed ? 'expandSidebar' : 'collapseSidebar')} title={tr(collapsed ? 'expandSidebar' : 'collapseSidebar')} aria-expanded={!collapsed} aria-controls="dashboard-sidebar" onClick={() => setCollapsed(value => !value)}>{collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</button>
      <button ref={menu} type="button" className="dash-menu" aria-label={tr('menu')} aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => { dialog.current?.showModal(); setDrawerOpen(true); }}><Menu aria-hidden="true" /></button><div className="dash-breadcrumb"><span>{tr(admin ? 'workspaceAdmin' : 'workspaceStudent')}</span><strong>{tr(tab)}</strong></div><div className="dash-toolbar"><button type="button" className="dash-tool-button" aria-label={t('workspace.searchTitle')} title={t('workspace.searchTitle')} aria-keyshortcuts="Control+k Meta+k" onClick={()=>setQuickOpen(true)}><Search size={20} aria-hidden="true" /></button><button type="button" className="dash-tool-button dash-refresh-button" aria-label={t(refreshing?'review.refreshing':'review.refresh')} title={t('review.refresh')} disabled={refreshing} onClick={onRefresh}><RefreshCw size={19} className={refreshing?'dash-refreshing':undefined} aria-hidden="true" /></button><DisplayControls showLanguage={false} />
      <Popover.Root open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <Popover.Trigger asChild><button type="button" className="dash-notifications" aria-label={tr('notifications')}><Bell size={20} aria-hidden="true" />{unread > 0 && <span />}</button></Popover.Trigger>
        <Popover.Portal><Popover.Content dir={language === 'ar' ? 'rtl' : 'ltr'} className="dash-notice-pop" align="end" sideOffset={14} collisionPadding={12} aria-label={tr('notifications')}>
          <div className="dash-notice-heading"><div><h2>{tr('notifications')}</h2><p>{tr('importantNotifications')}</p></div><Popover.Close aria-label={tr('close')}><X size={19} aria-hidden="true" /></Popover.Close></div>
          <div className="dash-notice-list">{importantNotifications.map(n => <article className={`dash-notice-item${n.read_at ? '' : ' is-unread'}`} key={n.id}><span className="dash-notice-symbol"><Bell size={18} aria-hidden="true" /></span><div><h3>{n.title.startsWith('notify_') ? tr(n.title) : n.title}</h3><p>{n.body}</p><time>{notificationDate(n.created_at)}</time>{!n.read_at && <button disabled={notificationBusy} onClick={() => onRead(n.id)}>{tr('markRead')}</button>}</div></article>)}{!importantNotifications.length && <div className="dash-notice-empty"><Bell size={30} aria-hidden="true" /><p>{tr('notificationsEmpty')}</p></div>}</div>
          {notificationError && <p role="alert">{notificationError}</p>}
          <button className="dash-notice-all" onClick={() => select('notifications')}>{tr('allNotifications')} <ArrowUpRight size={16} aria-hidden="true" /></button>
        </Popover.Content></Popover.Portal>
      </Popover.Root>
      <button type="button" className="dash-avatar dash-profile" aria-label={tr('profile')} onClick={() => select('profile')}><AccountAvatar user={user} /></button></div></header>
      <main id="dashboard-content" className="p4-workspace dash-content" tabIndex={-1}>{children}</main>
      <footer className="dash-footer"><span>{tr('brand')}</span><span>{tr('welcomeNote')}</span></footer>
    </div>
  </div>;
}

type OverviewProps = {admin: boolean; user: AuthUser; data: any; timezone: string; refreshKey?:number; onTab: (key: string) => void};
export function DashboardOverview({admin, user, data, timezone, refreshKey, onTab}: OverviewProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const tr = (key: string) => t('p4.' + key);
  const Arrow = language === 'ar' ? ChevronLeft : ChevronRight;
  const primary = admin ? ['activeStudents', 'newApplications', 'upcomingLessons', 'upcomingAssessments'] : ['upcomingLessons', 'attendanceSummary', 'attendanceRate', 'unreadMessages'];
  const upcoming = data.lessons.filter((l: any) => l.status === 'scheduled' && new Date(l.starts_at) > new Date()).sort((a: any, b: any) => +new Date(a.starts_at) - +new Date(b.starts_at)).slice(0, 5);
  const number = (key: string, value: unknown) => value == null ? tr('noData') : new Intl.NumberFormat(language).format(Number(value)) + (key === 'attendanceRate' ? '%' : '');
  const statIcons = [Users, ClipboardList, CalendarDays, Clock3];
  const today = new Intl.DateTimeFormat(language, {day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone}).format(new Date());
  return <>
    <section className="dash-welcome"><div><p className="dash-eyebrow">{tr('greeting')}</p><h1>{user.name}</h1><p>{tr(admin ? 'adminIntro' : 'studentIntro')}</p></div><div className="dash-today"><CalendarDays size={21} aria-hidden="true" /><span>{tr('overviewDate')}<strong>{today}</strong></span></div></section>
    <section aria-label={tr(admin ? 'academyPulse' : 'learningPulse')} className="dash-stats">{primary.map((key, i) => {const Icon = admin ? statIcons[i] : [CalendarDays, BookOpen, CheckCheck, Mail][i];return <article className="dash-stat-card" key={key}><div><span>{tr(key)}</span><Icon size={21} aria-hidden="true" /></div><strong className={data.stats[key] == null ? "dash-stat-empty" : undefined}>{number(key, data.stats[key])}</strong><span className="dash-stat-line" /><button className="dash-stat-open" aria-label={t('review.openSection',{section:tr(({activeStudents:'students',newApplications:'applications',upcomingLessons:'lessons',upcomingAssessments:'applications',attendanceSummary:'attendance',attendanceRate:'attendance',unreadMessages:'messages'} as Record<string,string>)[key])})} onClick={()=>onTab(({activeStudents:'students',newApplications:'applications',upcomingLessons:'lessons',upcomingAssessments:'applications',attendanceSummary:'attendance',attendanceRate:'attendance',unreadMessages:'messages'} as Record<string,string>)[key])}><ArrowUpRight size={19} aria-hidden="true" /></button></article>;})}</section>
    <div className="dash-overview-grid"><div className="dash-overview-main">
      <section className="dash-panel"><div className="dash-section-heading"><div><p className="dash-eyebrow">{tr('lessons')}</p><h2>{tr('scheduleTitle')}</h2></div><button className="dash-text-button" onClick={() => onTab('lessons')}>{tr('viewAll')}<Arrow size={17} aria-hidden="true" /></button></div>
        <p className="dash-zone"><Clock3 size={14} aria-hidden="true" /><bdi>{timezone}</bdi></p>
        <div className="dash-schedule">{upcoming.map((lesson: any) => <button key={lesson.id} className="dash-lesson" onClick={() => onTab('lessons')} aria-label={`${tr('openSchedule')}: ${lesson.title}`}><span className="dash-date-tile"><strong>{new Intl.DateTimeFormat(language, {day:'numeric',timeZone:timezone}).format(new Date(lesson.starts_at))}</strong><span>{new Intl.DateTimeFormat(language, {month:'short',timeZone:timezone}).format(new Date(lesson.starts_at))}</span></span><span className="dash-lesson-info"><span className="dash-status">{t('p4.states.' + lesson.status)}</span><strong>{lesson.title}</strong>{admin && <span>{data.people?.find((p: any) => p.id === lesson.student_id)?.name}</span>}</span><span className="dash-lesson-time"><strong>{new Intl.DateTimeFormat(language, {hour:'numeric',minute:'2-digit',timeZone:timezone}).format(new Date(lesson.starts_at))}</strong><span>{new Intl.DateTimeFormat(language, {weekday:'long',timeZone:timezone}).format(new Date(lesson.starts_at))}</span></span><Arrow size={18} aria-hidden="true" /></button>)}{!upcoming.length && <div className="dash-empty"><CalendarDays size={32} aria-hidden="true" /><p>{tr('scheduleEmpty')}</p></div>}</div>
      </section>
      <section className="dash-panel"><div className="dash-section-heading"><h2>{tr('recentMessages')}</h2><button className="dash-text-button" onClick={() => onTab('messages')}>{tr('viewAll')}<Arrow size={17} aria-hidden="true" /></button></div>{data.messages.slice(0, 3).map((message: any) => <button key={message.id} className="dash-message" onClick={() => onTab('messages')}><span className="dash-message-icon"><Mail size={20} aria-hidden="true" /></span><span><strong>{message.subject}</strong><span>{message.body}</span></span><Arrow size={18} aria-hidden="true" /></button>)}{!data.messages.length && <p className="dash-muted">{tr('empty')}</p>}</section>
      {!admin && <section className="dash-panel dash-live"><h2>{tr('resourcesTitle')}</h2><StudentLiveResources timezone={timezone} refreshKey={refreshKey} /></section>}
    </div><aside className="dash-overview-aside">
      <LessonCompletion lessons={data.lessons} admin={admin} onOpen={()=>onTab('lessons')} /><section className="dash-action-panel"><h2>{tr('quickActions')}</h2><p>{tr(admin ? 'workspaceAdmin' : 'workspaceStudent')}</p>{(admin ? ['applications','lessons','students'] : ['lessons','homework','profile']).map(key => {const Icon=icons[key]; return <button key={key} onClick={() => onTab(key)}><Icon size={18} aria-hidden="true" /><span>{tr(key)}</span><ArrowUpRight size={17} aria-hidden="true" /></button>;})}</section>
      <section className="dash-panel"><h2>{tr('secondaryStats')}</h2><dl className="dash-activity">{Object.entries(data.stats).filter(([key]) => !primary.includes(key) && key !== 'completedUnits').map(([key,value]) => <div key={key}><dt>{tr(key)}</dt><dd>{number(key,value)}</dd></div>)}</dl></section>
      {admin && <section className="dash-panel"><h2>{tr('integrations')}</h2><div className="dash-connections">{data.connections.map((connection: any) => <div key={connection.provider}><span>{t('integrations.'+connection.provider)}</span><span className="dash-connection-state">{t('integrations.'+connection.status)}</span></div>)}</div><Link className="dash-text-button" href="/admin/integrations">{tr('connectionDetails')}<Arrow size={17} aria-hidden="true" /></Link></section>}
    </aside></div>
  </>;
}
