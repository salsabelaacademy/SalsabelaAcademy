import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { conversationApi, serviceErrorKey } from "@/lib/dashboard-api";
export function ServiceErrorNotice({
  error,
  retry,
  ai = false,
}: {
  error: unknown;
  retry?: () => void;
  ai?: boolean;
}) {
  const { t } = useTranslation(),
    { user } = useAuth();
  const [details, setDetails] = useState(false);
  const key = serviceErrorKey(error),
    message = error instanceof Error ? error.message : "";
  const diagnostic = useQuery<any>({
    queryKey: ["service-diagnostics", user?.id],
    enabled: details && user?.role === "admin",
    retry: false,
    queryFn: async () => {
      const value = await conversationApi("/admin/service-diagnostics");
      if (value.apiRevision !== "academy-services-2026-10-09")
        throw new Error("api_response_invalid");
      return value;
    },
  });
  const translation =
    message === "not_configured"
      ? "dashboardUpdate.notConfigured"
      : message === "limited"
        ? "dashboardUpdate.limited"
        : message === "ai_credentials"
          ? "finalPolish.ai_credentials"
          : ai && message === "ai_unavailable"
            ? "dashboardUpdate.aiUnavailable"
            : "finalPolish." + key;
  return (
    <div className="service-error-notice" role="alert">
      <div className="service-error-heading">
        <AlertCircle size={18} aria-hidden />
        <p>{t(translation)}</p>
      </div>
      <div className="service-error-actions">
        {retry && (
          <button type="button" onClick={retry}>
            <RefreshCw size={16} aria-hidden />
            {t("dashboardUpdate.retry")}
          </button>
        )}
        {user?.role === "admin" && (
          <button
            type="button"
            aria-expanded={details}
            onClick={() => setDetails((v) => !v)}
          >
            <ChevronDown size={16} aria-hidden />
            {t("finalPolish.diagnostics")}
          </button>
        )}
      </div>
      {details && user?.role === "admin" && (
        <section className="service-diagnostic">
          <p>{t("finalPolish.diagnosticHint")}</p>
          {diagnostic.isPending ? (
            <p>{t("p4.loading")}</p>
          ) : diagnostic.isError ? (
            <p>{t("finalPolish." + serviceErrorKey(diagnostic.error))}</p>
          ) : (
            <>
              <dl>
                {[
                  ["schema", diagnostic.data.schemaReady],
                  ["gemini", diagnostic.data.geminiConfigured],
                  ["mail", diagnostic.data.emailConfigured],
                ].map(([name, ready]) => (
                  <div key={String(name)}>
                    <dt>{t("finalPolish.check_" + name)}</dt>
                    <dd>
                      {t("finalPolish." + (ready ? "ready" : "needsSetup"))}
                    </dd>
                  </div>
                ))}
              </dl>
              {diagnostic.data.missingSettings?.length > 0 && (
                <p>
                  {t("finalPolish.missing")}:{" "}
                  <bdi>{diagnostic.data.missingSettings.join(", ")}</bdi>
                </p>
              )}
              {!diagnostic.data.schemaReady && (
                <p>{t("finalPolish.migrationCommands")}</p>
              )}
              <p>{t("finalPolish.providerUntested")}</p>
              <button type="button" onClick={() => void diagnostic.refetch()}>
                {t("finalPolish.connectionRetry")}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
