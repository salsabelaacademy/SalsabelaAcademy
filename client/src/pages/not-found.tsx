import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/PublicShell";
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <PublicShell>
      <section className="p4-section">
        <h1>{t("p4.notFound")}</h1>
        <Link className="p4-button" href="/">
          {t("p4.home")}
        </Link>
      </section>
    </PublicShell>
  );
}
