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
};

export type ProviderSendMessageResult = {
  providerMessageId?: string;
  deliveryStatus: "queued" | "sent" | "failed";
  errorMessage?: string;
};

export interface MessagingProvider {
  key: string;
  channelType: MessagingChannelType;
  parseInboundRequest(request: Request): Promise<NormalizedInboundMessage>;
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

  const response = await fetch(
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

  const payload = (await response.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      deliveryStatus: "failed",
      errorMessage: payload.message ?? "Twilio send failed.",
    };
  }

  return {
    providerMessageId: payload.sid,
    deliveryStatus: payload.status === "queued" ? "queued" : "sent",
  };
}

const providers: Record<string, MessagingProvider> = {
  twilio: {
    key: "twilio",
    channelType: "sms",
    parseInboundRequest: parseTwilioInboundRequest,
    sendMessage: sendTwilioMessage,
  },
};

export function getMessagingProvider(providerKey: string) {
  return providers[providerKey] ?? null;
}
