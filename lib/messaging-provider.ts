import crypto from "crypto";
import type { MessagingChannelType } from "../types";

export type NormalizedInboundMessage = {
  providerKey: string;
  channelType: MessagingChannelType;
  externalMessageId?: string;
  participantAddress: string;
  assistantAddress?: string;
  content: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderSendMessageInput = {
  toAddress: string;
  fromAddress?: string;
  content: string;
  statusCallbackUrl?: string;
};

export type ProviderSendMessageResult = {
  providerMessageId?: string;
  deliveryStatus: "queued" | "sent" | "failed";
  errorMessage?: string;
  rawStatus?: string;
  shouldRetry?: boolean;
};

export type ProviderStatusUpdate = {
  providerKey: string;
  externalMessageId: string;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed";
  errorMessage?: string;
  rawStatus?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export interface MessagingProvider {
  key: string;
  channelType: MessagingChannelType;
  parseInboundRequest(request: Request): Promise<NormalizedInboundMessage>;
  parseStatusCallback?(request: Request): Promise<ProviderStatusUpdate | null>;
  sendMessage(input: ProviderSendMessageInput): Promise<ProviderSendMessageResult>;
}

function parseTwilioSignaturePayload(url: string, params: URLSearchParams) {
  const sortedKeys = Array.from(params.keys()).sort();
  return sortedKeys.reduce((payload, key) => `${payload}${key}${params.get(key) ?? ""}`, url);
}

async function parseTwilioInboundRequest(request: Request): Promise<NormalizedInboundMessage> {
  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  if (authToken && signature) {
    const expected = crypto
      .createHmac("sha1", authToken)
      .update(parseTwilioSignaturePayload(request.url, params))
      .digest("base64");

    if (expected !== signature) {
      throw new Error("Invalid Twilio signature.");
    }
  }

  const from = params.get("From")?.trim();
  const body = params.get("Body")?.trim();

  if (!from || !body) {
    throw new Error("Twilio webhook is missing From or Body.");
  }

  return {
    providerKey: "twilio",
    channelType: "sms",
    externalMessageId: params.get("MessageSid") ?? undefined,
    participantAddress: from,
    assistantAddress: params.get("To") ?? undefined,
    content: body,
    receivedAt: new Date().toISOString(),
    metadata: Object.fromEntries(params.entries()),
  };
}

function mapTwilioMessageStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case "queued":
    case "accepted":
    case "scheduled":
      return "queued" as const;
    case "sending":
    case "sent":
      return "sent" as const;
    case "delivered":
      return "delivered" as const;
    case "undelivered":
    case "failed":
    case "canceled":
      return "failed" as const;
    default:
      return null;
  }
}

async function parseTwilioStatusCallback(request: Request): Promise<ProviderStatusUpdate | null> {
  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  if (authToken && signature) {
    const expected = crypto
      .createHmac("sha1", authToken)
      .update(parseTwilioSignaturePayload(request.url, params))
      .digest("base64");

    if (expected !== signature) {
      throw new Error("Invalid Twilio signature.");
    }
  }

  const externalMessageId = params.get("MessageSid")?.trim();
  const rawStatus = params.get("MessageStatus")?.trim();
  const deliveryStatus = mapTwilioMessageStatus(rawStatus);

  if (!externalMessageId || !deliveryStatus) {
    return null;
  }

  const errorCode = params.get("ErrorCode")?.trim();
  const errorMessage = params.get("ErrorMessage")?.trim();

  return {
    providerKey: "twilio",
    externalMessageId,
    deliveryStatus,
    errorMessage:
      deliveryStatus === "failed"
        ? errorMessage || (errorCode ? `Twilio error ${errorCode}.` : "Twilio reported a failed delivery.")
        : undefined,
    rawStatus: rawStatus ?? undefined,
    occurredAt: new Date().toISOString(),
    metadata: {
      errorCode: errorCode || undefined,
      smsStatus: params.get("SmsStatus") ?? undefined,
      to: params.get("To") ?? undefined,
      from: params.get("From") ?? undefined,
    },
  };
}

async function sendTwilioMessage(
  input: ProviderSendMessageInput,
): Promise<ProviderSendMessageResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const defaultFrom = process.env.TWILIO_SMS_FROM_NUMBER;

  if (!accountSid || !authToken || !defaultFrom) {
    return {
      deliveryStatus: "failed",
      errorMessage:
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM_NUMBER.",
    };
  }

  const form = new URLSearchParams({
    To: input.toAddress,
    From: input.fromAddress ?? defaultFrom,
    Body: input.content,
  });
  if (input.statusCallbackUrl) {
    form.set("StatusCallback", input.statusCallbackUrl);
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
  } catch (error) {
    return {
      deliveryStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Twilio send failed.",
      shouldRetry: true,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      deliveryStatus: "failed",
      errorMessage: payload.message ?? "Twilio send failed.",
      rawStatus: payload.status,
      shouldRetry: response.status === 429 || response.status >= 500,
    };
  }

  const mappedStatus = mapTwilioMessageStatus(payload.status) ?? "sent";
  return {
    providerMessageId: payload.sid,
    deliveryStatus: mappedStatus === "delivered" ? "sent" : mappedStatus,
    rawStatus: payload.status,
  };
}

const providers: Record<string, MessagingProvider> = {
  twilio: {
    key: "twilio",
    channelType: "sms",
    parseInboundRequest: parseTwilioInboundRequest,
    parseStatusCallback: parseTwilioStatusCallback,
    sendMessage: sendTwilioMessage,
  },
};

export function getMessagingProvider(providerKey: string) {
  return providers[providerKey] ?? null;
}
