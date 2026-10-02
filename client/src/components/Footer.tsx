import { Link } from "wouter";
import { useTranslation } from "react-i18next";
const logoIcon = "/images/logo1.webp";
const logoText = "/images/logo3.webp";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-20 pb-10 text-start">
      <div className="container-wide grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
        {/* Brand */}
        <div className="space-y-4">
          <Link href="/" className="flex flex-col gap-3 mb-4 group">
            <div className="flex items-center gap-3">
              <img
                src={logoIcon}
                alt=""
                width="44" height="44" className="academy-brand-icon"
              />
              <img
                src={logoText}
                alt={t("p4.brand")}
                width="210" height="60" className="academy-brand-wordmark"
              />
            </div>
          </Link>
          <p className="text-slate-400 text-sm leading-relaxed">
            {t("footer.desc")}
          </p>
        </div>

        {/* Links */}
        <div>
          <h3 className="text-white font-display font-bold mb-6">{t("footer.quick_links")}</h3>
          <ul className="space-y-3 text-sm">
            <li><Link href="/how-it-works" className="hover:text-primary transition-colors">{t("experience.howNav")}</Link></li>
            <li><Link href="/about" className="hover:text-primary transition-colors">{t("nav.about")}</Link></li>
            <li><Link href="/courses" className="hover:text-primary transition-colors">{t("nav.courses")}</Link></li>
            <li><Link href="/pricing" className="hover:text-primary transition-colors">{t("footer.pricing")}</Link></li>
            <li><Link href="/blog" className="hover:text-primary transition-colors">{t("pageUi.Footer.Blog")}</Link></li>
            <li><Link href="/contact" className="hover:text-primary transition-colors">{t("nav.contact")}</Link></li>
          </ul>
        </div>

        {/* Courses */}
        <div>
          <h3 className="text-white font-display font-bold mb-6">{t("footer.our_courses")}</h3>
          <ul className="space-y-3 text-sm">
            <li><Link href="/courses" className="hover:text-primary transition-colors">{t("pageUi.Footer.Quran_Recitation")}</Link></li>
            <li><Link href="/courses" className="hover:text-primary transition-colors">{t("pageUi.Footer.Tajweed_Rules")}</Link></li>
            <li><Link href="/courses" className="hover:text-primary transition-colors">{t("pageUi.Footer.Hifz_Program")}</Link></li>
            <li><Link href="/courses" className="hover:text-primary transition-colors">{t("pageUi.Footer.Arabic_Language")}</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-white font-display font-bold mb-6">{t("footer.contact_us")}</h3>
          <ul className="space-y-4 text-sm">
            <li className="flex items-center gap-3">

              <a href="tel:+201152741590" dir="ltr" className="hover:text-primary transition-colors">+20 1152741590</a>
            </li>
            <li className="flex items-center gap-3">

              <div className="flex flex-col gap-2 min-w-0"><a dir="ltr" href="mailto:info@salsabela.com" className="hover:text-primary transition-colors break-all">info@salsabela.com</a><a dir="ltr" href="mailto:salsabela.academy@gmail.com" className="hover:text-primary transition-colors break-all">salsabela.academy@gmail.com</a></div>
            </li>
          </ul>
        </div>
      </div>

      <div className="container-wide pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} {t("p4.brand")}. {t("footer.rights")}</p>
      </div>
    </footer>
  );
}
