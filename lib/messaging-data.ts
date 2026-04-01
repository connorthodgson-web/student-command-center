import type {
  MessagingAuthorRole,
  MessagingChannelType,
  MessagingConversation,
  MessagingConversationStatus,
  MessagingDeliveryStatus,
  MessagingDirection,
  MessagingEndpoint,
  MessagingMessage,
  MessagingVerificationStatus,
} from "../types";

const CHANNEL_TYPES: MessagingChannelType[] = ["sms", "web", "email", "test"];
const CONVERSATION_STATUSES: MessagingConversationStatus[] = ["active", "archived"];
const MESSAGE_DIRECTIONS: MessagingDirection[] = ["inbound", "outbound"];
const MESSAGE_AUTHOR_ROLES: MessagingAuthorRole[] = ["user", "assistant", "system"];
const MESSAGE_DELIVERY_STATUSES: MessagingDeliveryStatus[] = [
  "received",
  "processing",
  "queued",
  "sent",
  "delivered",
  "failed",
];

export type DbMessagingEndpointRow = {
  id: string;
  user_id: string;
  channel_type: MessagingChannelType;
  provider_key: string | null;
  address: string;
  label: string | null;
  is_active: boolean;
  is_preferred: boolean;
  verification_status: MessagingVerificationStatus;
  verified_at: string | null;
  verification_expires_at: string | null;
  verification_attempt_count: number | null;
  last_verification_sent_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbMessagingConversationRow = {
  id: string;
  user_id: string;
  endpoint_id: string | null;
  assistant_session_id: string | null;
  channel_type: MessagingChannelType;
  provider_key: string | null;
  status: MessagingConversationStatus;
  participant_address: string | null;
  assistant_address: string | null;
  title: string | null;
  provider_thread_id: string | null;
  external_reference: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbMessagingMessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  channel_type: MessagingChannelType;
  provider_key: string | null;
  provider_message_id: string | null;
  direction: MessagingDirection;
  author_role: MessagingAuthorRole;
  delivery_status: MessagingDeliveryStatus;
  content: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  attempt_count: number | null;
  last_attempted_at: string | null;
  last_error_at: string | null;
  provider_last_status: string | null;
  provider_status_updated_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type MessagingEndpointInput = {
  channelType: MessagingChannelType;
  providerKey?: string;
  address: string;
  label?: string;
  isActive?: boolean;
  isPreferred?: boolean;
};

export function mapDbMessagingEndpoint(row: DbMessagingEndpointRow): MessagingEndpoint {
  return {
    id: row.id,
    userId: row.user_id,
    channelType: row.channel_type,
    providerKey: row.provider_key ?? undefined,
    address: row.address,
    label: row.label ?? undefined,
    isActive: row.is_active,
    isPreferred: row.is_preferred,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at ?? undefined,
    verificationExpiresAt: row.verification_expires_at ?? undefined,
    verificationAttemptCount: row.verification_attempt_count ?? undefined,
    lastVerificationSentAt: row.last_verification_sent_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbMessagingConversation(
  row: DbMessagingConversationRow,
): MessagingConversation {
  return {
    id: row.id,
    userId: row.user_id,
    endpointId: row.endpoint_id ?? undefined,
    assistantSessionId: row.assistant_session_id ?? undefined,
    channelType: row.channel_type,
    providerKey: row.provider_key ?? undefined,
    status: row.status,
    participantAddress: row.participant_address ?? undefined,
    assistantAddress: row.assistant_address ?? undefined,
    title: row.title ?? undefined,
    providerThreadId: row.provider_thread_id ?? undefined,
    externalReference: row.external_reference ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbMessagingMessage(row: DbMessagingMessageRow): MessagingMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    channelType: row.channel_type,
    providerKey: row.provider_key ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    direction: row.direction,
    authorRole: row.author_role,
    deliveryStatus: row.delivery_status,
    content: row.content,
    errorMessage: row.error_message ?? undefined,
    metadata: row.metadata ?? undefined,
    attemptCount: row.attempt_count ?? undefined,
    lastAttemptedAt: row.last_attempted_at ?? undefined,
    lastErrorAt: row.last_error_at ?? undefined,
    providerLastStatus: row.provider_last_status ?? undefined,
    providerStatusUpdatedAt: row.provider_status_updated_at ?? undefined,
    sentAt: row.sent_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function normalizeMessagingEndpointInput(
  input: MessagingEndpointInput,
  options: { requireAddress?: boolean } = {},
) {
  if (!CHANNEL_TYPES.includes(input.channelType)) {
    throw new Error("Unsupported channel type.");
  }

  const address = normalizeChannelAddress(input.channelType, input.address);
  if (options.requireAddress && !address) {
    throw new Error("Address is required.");
  }

  return {
    channel_type: input.channelType,
    provider_key: emptyToNull(input.providerKey),
    address,
    label: emptyToNull(input.label),
    is_active: input.isActive ?? true,
    is_preferred: input.isPreferred ?? false,
  };
}

export function normalizeChannelAddress(channelType: MessagingChannelType, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Address cannot be empty.");
  }

  if (channelType === "sms") {
    const digits = trimmed.replace(/[^\d+]/g, "");
    const hasLeadingPlus = digits.startsWith("+");
    const numeric = digits.replace(/\D/g, "");

    if (hasLeadingPlus) {
      if (numeric.length < 10 || numeric.length > 15) {
        throw new Error("SMS numbers should be in E.164 format, like +15551234567.");
      }
      return `+${numeric}`;
    }

    if (numeric.length === 10) {
      return `+1${numeric}`;
    }

    if (numeric.length >= 11 && numeric.length <= 15) {
      return `+${numeric}`;
    }

    throw new Error("SMS numbers should be in E.164 format, like +15551234567.");
  }

  return trimmed.toLowerCase();
}

export function assertConversationStatus(value: string) {
  if (!CONVERSATION_STATUSES.includes(value as MessagingConversationStatus)) {
    throw new Error("Invalid conversation status.");
  }
}

export function assertMessageDirection(value: string) {
  if (!MESSAGE_DIRECTIONS.includes(value as MessagingDirection)) {
    throw new Error("Invalid message direction.");
  }
}

export function assertMessageAuthorRole(value: string) {
  if (!MESSAGE_AUTHOR_ROLES.includes(value as MessagingAuthorRole)) {
    throw new Error("Invalid message author role.");
  }
}

export function assertMessageDeliveryStatus(value: string) {
  if (!MESSAGE_DELIVERY_STATUSES.includes(value as MessagingDeliveryStatus)) {
    throw new Error("Invalid message delivery status.");
  }
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
