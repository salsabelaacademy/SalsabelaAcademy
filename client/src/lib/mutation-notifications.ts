import i18n from "./i18n";
import { toast } from "@/hooks/use-toast";
let installed = false;
/** Observe same-origin API mutations only. GET polling never produces a toast. */
export function installMutationNotifications() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await original(input, init);
    const request = input instanceof Request ? input : null;
    const method = (init?.method || request?.method || "GET").toUpperCase();
    const url = new URL(request?.url || String(input), location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith("/api/") ||
      !["POST", "PUT", "PATCH", "DELETE"].includes(method) ||
      /\/(?:assistant|push|auth)\/|\/integrations\/|\/admin\/notifications\/test$|\/conversations\/\d+\/read$|\/notifications\/(?:\d+\/read|read-all)$/.test(
        url.pathname,
      )
    )
      return response;
    const value = await response
      .clone()
      .json()
      .catch(() => ({}));
    if (response.ok) {
      if (
        url.pathname === "/api/admin/email-deliveries/retry" &&
        value.count === 0
      )
        return response;
      window.dispatchEvent(new Event("academy:data-changed"));
      if (
        !/^\/api\/(?:portal\/|admin\/(?:lesson-series|email-deliveries\/retry|lessons|applications|students|enrollments)|conversations\/|lessons\/|posts(?:\/|$)|notifications\/)/.test(
          url.pathname,
        )
      )
        return response;
      const key = value.url
        ? "opened"
        : value.queued
          ? "queued"
          : url.pathname.includes("/conversations/")
            ? "sent"
            : url.pathname.includes("/lesson-series")
              ? "seriesSaved"
              : url.pathname.endsWith("/followup")
                ? "sent"
                : "saved";
      toast({
        title: i18n.t("dashboardUpdate." + key),
        description:
          value.emailDelivery === false
            ? i18n.t("p4.emailUnavailable")
            : undefined,
        duration: 4000,
      });
      window.dispatchEvent(new Event("academy:data-changed"));
    } else
      toast({
        title: i18n.t(
          "dashboardUpdate." + (response.status === 429 ? "limited" : "failed"),
        ),
        variant: "destructive",
        duration: 5000,
      });
    return response;
  };
}
