import { MessageSquare, type LucideProps } from "lucide-react";

/** Use the academy's existing Lucide icon family for every chat entry point. */
export function CommunicationIcon({ filled = false, ...props }: LucideProps & { filled?: boolean }) {
  return <MessageSquare {...props} fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 1 : undefined} aria-hidden="true" />;
}
