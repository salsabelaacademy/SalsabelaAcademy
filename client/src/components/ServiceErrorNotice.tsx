import { useTranslation } from "react-i18next";
import { AlertCircle, RefreshCw } from "lucide-react";
import { serviceErrorKey } from "@/lib/dashboard-api";

/** Customer-facing errors never embed a server diagnostic console. */
export function ServiceErrorNotice({ error, retry, ai = false }: {
  error: unknown; retry?: () => void; ai?: boolean;
}) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : "";
  const translation = message === "not_configured"
    ? "dashboardUpdate.notConfigured"
    : message === "limited" ? "dashboardUpdate.limited"
    : message === "ai_credentials" ? "finalPolish.ai_credentials"
    : ai && message === "ai_unavailable" ? "dashboardUpdate.aiUnavailable"
    : "finalPolish." + serviceErrorKey(error);
  return <div className="service-error-notice" role="alert">
    <div className="service-error-heading"><AlertCircle size={18} aria-hidden="true" /><p>{t(translation)}</p></div>
    {retry && <button type="button" className="conversation-retry" onClick={retry}><RefreshCw size={16} aria-hidden="true" />{t("dashboardUpdate.retry")}</button>}
  </div>;
}
