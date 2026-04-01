import type { MessagingEndpoint, MessagingLaunchStatus, MessagingReadiness } from "../types";

function hasConfiguredEnvValue(value: string | undefined) {
  return Boolean(value && !value.startsWith("your-"));
}

export function getMessagingEnvironmentReadiness() {
  const serviceRoleConfigured = hasConfiguredEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const smsProviderConfigured =
    hasConfiguredEnvValue(process.env.TWILIO_ACCOUNT_SID) &&
    hasConfiguredEnvValue(process.env.TWILIO_AUTH_TOKEN) &&
    hasConfiguredEnvValue(process.env.TWILIO_SMS_FROM_NUMBER);
  const deliveryStatusTrackingAvailable = hasConfiguredEnvValue(
    process.env.TWILIO_STATUS_CALLBACK_URL,
  );
  const simulatedVerificationAvailable = process.env.NODE_ENV !== "production";

  return {
    serviceRoleConfigured,
    smsProviderConfigured,
    deliveryStatusTrackingAvailable,
    simulatedVerificationAvailable,
    verificationSupported: serviceRoleConfigured && (smsProviderConfigured || simulatedVerificationAvailable),
    deliveryAvailable: serviceRoleConfigured && smsProviderConfigured,
  };
}

export function buildMessagingReadiness(endpoints: MessagingEndpoint[]): MessagingReadiness {
  const environment = getMessagingEnvironmentReadiness();
  const smsEndpoints = endpoints.filter((endpoint) => endpoint.channelType === "sms");
  const activeSmsEndpoints = smsEndpoints.filter((endpoint) => endpoint.isActive);
  const verifiedSmsEndpoint =
    activeSmsEndpoints.find(
      (endpoint) => endpoint.verificationStatus === "verified" && endpoint.isPreferred,
    ) ??
    activeSmsEndpoints.find((endpoint) => endpoint.verificationStatus === "verified") ??
    null;
  const recommendedAddress = verifiedSmsEndpoint?.address ?? smsEndpoints[0]?.address;
  const issues: string[] = [];

  if (!environment.serviceRoleConfigured) {
    issues.push("Missing SUPABASE_SERVICE_ROLE_KEY, so verification, send, and inbound processing cannot run.");
  }

  if (!environment.smsProviderConfigured) {
    issues.push("Missing Twilio SMS credentials, so live outbound text delivery is unavailable.");
  }

  if (environment.smsProviderConfigured && !environment.deliveryStatusTrackingAvailable) {
    issues.push(
      "Missing TWILIO_STATUS_CALLBACK_URL, so send attempts can start but delivery receipts and final failure updates will stay incomplete.",
    );
  }

  let launchStatus: MessagingLaunchStatus = "missing";
  let statusLabel = "Phone number missing";
  let statusDetail = "Add a mobile number to start SMS setup.";

  if (smsEndpoints.length === 0) {
    return {
      ...environment,
      launchStatus,
      statusLabel,
      statusDetail,
      issues,
      recommendedAddress,
    };
  }

  if (!verifiedSmsEndpoint) {
    launchStatus = "unverified";
    statusLabel = "Phone number needs verification";
    statusDetail = environment.verificationSupported
      ? "A number is saved, but SMS stays off until you send and confirm a verification code."
      : "A number is saved, but verification cannot run until the messaging backend is configured.";

    return {
      ...environment,
      launchStatus,
      statusLabel,
      statusDetail,
      issues,
      recommendedAddress,
    };
  }

  if (!environment.deliveryAvailable) {
    launchStatus = "delivery_unavailable";
    statusLabel = "Delivery unavailable";
    statusDetail =
      "Your number is verified, but live SMS delivery is still unavailable because the outbound provider is not fully configured.";

    return {
      ...environment,
      launchStatus,
      statusLabel,
      statusDetail,
      issues,
      recommendedAddress,
    };
  }

  launchStatus = "verified";
  statusLabel = "Ready for SMS";
  statusDetail = `Verified SMS delivery is available${recommendedAddress ? ` at ${recommendedAddress}` : ""}.`;

  return {
    ...environment,
    launchStatus,
    statusLabel,
    statusDetail,
    issues,
    recommendedAddress,
  };
}
