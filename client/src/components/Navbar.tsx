import { Link, useLocation } from "wouter";
import { Menu, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
const logoIcon = "/images/logo1.webp";
const logoTextLight = "/images/logo4.webp";
const logoTextDark = "/images/logo3.webp";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";

export function Navbar() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: t("nav.home"), href: "/" },
    { name: t("nav.courses"), href: "/courses" },
    { name: t("experience.howNav"), href: "/how-it-works" },
    { name: t("pageUi.Navbar.Pricing"), href: "/pricing" },
    { name: t("pageUi.Navbar.Blog"), href: "/blog" },
    { name: t("nav.about"), href: "/about" },
    { name: t("nav.contact"), href: "/contact" },
  ];

  const navBg = isScrolled
    ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm py-4"
    : "bg-transparent py-6";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="container-wide flex items-center justify-between">
        <Link href="/" className="flex flex-col gap-3 mb-1 group">
            <div className="flex items-center gap-3 mt-1">
            <img
              src={logoIcon}
              alt=""
              width="44" height="44" className="academy-brand-icon"
            />
            <img
              src={isDark ? logoTextDark : logoTextLight}
              alt={t("p4.brand")}
              width="210" height="60" className="academy-brand-wordmark"
            />
          </div>
        </Link>


        {/* Desktop Nav */}
        <div className="hidden xl:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location === link.href
                  ? "text-primary font-semibold"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-700 pl-6 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-6">
            <button
              onClick={toggleTheme}
              aria-label={t("pageUi.Navbar.Toggle_dark_mode")}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LanguageSwitcher />
            <Link href={user ? getDashboardPath(user.role) : "/login"}>
              <Button className="btn-primary gap-2">

                {user ? (t("pageUi.Navbar.My_dashboard")) : (t("pageUi.Navbar.Sign_in"))}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="xl:hidden flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={t("pageUi.Navbar.Toggle_dark_mode")}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button aria-label={t("p4.menu")} variant="ghost" size="icon" className="hover:bg-primary/5 dark:hover:bg-primary/10">
                <Menu className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              </Button>
            </SheetTrigger>
            <SheetContent aria-describedby={undefined} side={isRTL ? "left" : "right"} className="w-[300px] sm:w-[360px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SheetTitle className="sr-only">{t("pageUi.Navbar.Navigation")}</SheetTitle><div className="flex flex-col h-full">
                <div className="px-5 pt-14 pb-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 mt-1">
                  <img
                    src={isDark ? logoTextDark : logoTextLight}
                    alt={t("p4.brand")}
                    className="h-10 w-36 object-contain"
                  />
                  </div>
                  <LanguageSwitcher />
                </div>
                <div className="flex-1 overflow-y-auto py-4 px-5">
                  <div className="flex flex-col gap-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 text-base font-medium py-3 px-3 rounded-xl transition-colors ${
                          location === link.href
                            ? "text-primary bg-primary/10 font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5"
                        }`}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                   <Link href={user ? getDashboardPath(user.role) : "/login"} onClick={() => setIsOpen(false)}>
                    <Button className="w-full btn-primary h-12 text-base shadow-lg shadow-primary/20">
                       {user ? (t("pageUi.Navbar.Open_dashboard")) : (t("pageUi.Navbar.Sign_in"))}
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
