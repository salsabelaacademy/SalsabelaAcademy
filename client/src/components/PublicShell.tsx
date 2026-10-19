import type {ReactNode} from 'react';
import {useLocation} from 'wouter';
import {useTranslation} from 'react-i18next';
import {LanguageSwitcher} from './LanguageSwitcher';
import {ThemeToggle} from './ThemeToggle';
import {Navbar} from './Navbar';
import {Footer} from './Footer';
export function DisplayControls({showLanguage=true}:{showLanguage?:boolean}={}){return <div className="flex items-center gap-2">{showLanguage && <LanguageSwitcher/>}<ThemeToggle/></div>}
export function PublicShell({children}:{children:ReactNode}){const {t}=useTranslation();const [location]=useLocation();return <div className="p4-site"><a className="p4-skip" href={(typeof window!=='undefined'?window.location.pathname+window.location.search:location)+'#main-content'}>{t('p4.skip')}</a><Navbar/><main id="main-content">{children}</main><Footer/></div>}
