import type {ReactNode} from 'react';
import {useLocation} from 'wouter';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/use-theme';
import {LanguageSwitcher} from './LanguageSwitcher';
import {Moon,Sun} from 'lucide-react';
import {Navbar} from './Navbar';
import {Footer} from './Footer';
export function DisplayControls({showLanguage=true}:{showLanguage?:boolean}={}){const {t}=useTranslation();const {isDark,toggleTheme}=useTheme();return <div className="flex items-center gap-1">{showLanguage && <LanguageSwitcher/>}<button className="p4-control" type="button" aria-label={t('p4.theme')} onClick={toggleTheme}>{isDark?<Sun size={20}/>:<Moon size={20}/>}</button></div>}
export function PublicShell({children}:{children:ReactNode}){const {t}=useTranslation();const [location]=useLocation();return <div className="p4-site"><a className="p4-skip" href={(typeof window!=='undefined'?window.location.pathname+window.location.search:location)+'#main-content'}>{t('p4.skip')}</a><Navbar/><main id="main-content">{children}</main><Footer/></div>}
