import {pageBackground} from '@shared/page-background';
import { PageMotion } from "@/components/PageMotion";
import { BrandLoading, MobileLanguageTransition } from "@/components/BrandLoading";
import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense, Component, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
const Articles = lazy(() => import("@/pages/Blog"));
const Article = lazy(() => import("@/pages/BlogPost"));
const Home = lazy(() => import('@/pages/Home'));
const Courses = lazy(() => import('@/pages/Courses'));
const CourseDetails = lazy(() => import('@/pages/CourseDetails'));
const About = lazy(() => import('@/pages/About'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Contact = lazy(() => import('@/pages/Contact'));
const PublicPage = lazy(() => import("@/pages/PublicPages"));
const AuthPage = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Application = lazy(() => import("@/pages/Application"));
const AccountFlow = lazy(() => import("@/pages/AccountFlows"));
import { Seo } from "@/components/Seo";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

import { useTranslation } from "react-i18next";
function RouteReady(){useEffect(()=>{document.documentElement.dataset.appReady="true"},[]);return null}
function RouteLoading(){useEffect(()=>{document.documentElement.dataset.appReady="false";return()=>{NProgress.done()}},[]);return <BrandLoading/>}
function RouteError(){const {t}=useTranslation();return <div className="restore-loading" role="alert"><h1>{t('restore.pageError')}</h1><button className="p4-button" onClick={()=>window.location.reload()}>{t('restore.retry')}</button></div>}
class PageBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<RouteError/>:this.props.children}}

NProgress.configure({ showSpinner: false, speed: 350, minimum: 0.1, barSelector: ".bar", template: '<div class="bar" aria-hidden="true"><div class="peg"></div></div>' });

function BackgroundPriority(){const [location]=useLocation();useEffect(()=>{const src=pageBackground(location);let link=document.head.querySelector<HTMLLinkElement>('link[data-background-priority]');if(!src){link?.remove();return;}if(!link){link=document.createElement('link');link.dataset.backgroundPriority='';link.rel='preload';link.as='image';document.head.append(link);}link.href=src;link.setAttribute('fetchpriority','high');},[location]);return null;}
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}


function Router() {
  const [location] = useLocation();




  return (
    <>
      <ScrollToTop /><Seo /><BackgroundPriority />

        <PageBoundary key={/^\/(admin|dashboard)(\/|$)/.test(location) ? 'workspace' : location}><Suspense fallback={<RouteLoading/>}><PageMotion><Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/programs"><Courses /></Route>
          <Route path="/how-it-works"><PublicPage /></Route>
          <Route path="/courses">
            <Courses />
          </Route>
          <Route path="/courses/:id">
            <CourseDetails />
          </Route>
          <Route path="/pricing">
            <Pricing />
          </Route>
          <Route path="/blog">
            <Articles />
          </Route>
          <Route path="/blog/:slug">
            <Article />
          </Route>
          <Route path="/contact">
            <Contact />
          </Route>
          <Route path="/about">
            <About />
          </Route>
          <Route path="/login">
            <AuthPage />
          </Route>
          <Route path="/apply"><Application /></Route>
          <Route path="/forgot-password"><AccountFlow mode="forgot" /></Route>
          <Route path="/reset-password"><AccountFlow mode="reset" /></Route>
          <Route path="/accept-invitation"><AccountFlow mode="invite" /></Route>
          <Route path="/verify-email"><AccountFlow mode="verify" /></Route>
          <Route path="/resend-verification"><AccountFlow mode="resend" /></Route>
          <Route path="/account/password"><AccountFlow mode="password" /></Route>
          <Route path="/dashboard/student">
            <Dashboard />
          </Route>
          <Route path="/dashboard/admin">
            <Dashboard />
          </Route>
          <Route path="/admin">
            <Dashboard />
          </Route>
          <Route path="/admin/integrations"><Dashboard /></Route>
          <Route path="/admin/new">
            <Dashboard />
          </Route>
          <Route path="/admin/edit/:id">
            <Dashboard />
          </Route>
          <Route>
            <NotFound />
          </Route>
        </Switch><RouteReady/></PageMotion></Suspense></PageBoundary>



    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster /><MobileLanguageTransition />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
