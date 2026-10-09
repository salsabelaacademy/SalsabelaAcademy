// Map only documented Resend error identifiers. Never expose provider messages.
export const emailErrorCodes = [
  "email_credentials",
  "email_permission",
  "email_sender",
  "email_validation",
  "email_quota",
  "email_rate_limited",
  "email_delivery_failed",
] as const;
export function emailErrorCode(
  error: unknown,
): (typeof emailErrorCodes)[number] {
  const name = (error as { name?: string } | null)?.name;
  if (name === "invalid_api_key" || name === "missing_api_key")
    return "email_credentials";
  if (name === "restricted_api_key" || name === "invalid_access")
    return "email_permission";
  if (name === "invalid_from_address") return "email_sender";
  if (
    name === "validation_error" ||
    name === "invalid_parameter" ||
    name === "missing_required_field"
  )
    return "email_validation";
  if (name === "monthly_quota_exceeded" || name === "daily_quota_exceeded")
    return "email_quota";
  if (name === "rate_limit_exceeded") return "email_rate_limited";
  return "email_delivery_failed";
}
