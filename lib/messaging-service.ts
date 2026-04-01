import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAssistantAction, saveParsedSchedule } from "./assistant-action-executor";
import {
  appendAssistantSessionEvent,
  appendAssistantSessionMessage,
  ensureAssistantSession,
} from "./assistant-sessions";
import { loadAssistantData } from "./assistant-data";
import { detectAssistantIntent } from "./assistant-intent";
import { createAdminClient } from "./supabase/admin";
import {
  mapDbMessagingConversation,
  mapDbMessagingEndpoint,
  mapDbMessagingMessage,
  normalizeChannelAddress,
  type DbMessagingConversationRow,
  type DbMessagingEndpointRow,
  type DbMessagingMessageRow,
} from "./messaging-data";
import { parseNaturalLanguageSchedule } from "./ai";
import { generateAssistantReply, type AssistantHistoryMessage } from "./assistant-chat";
import {
  getMessagingProvider,
  type ProviderSendMessageInput,
  type ProviderSendMessageResult,
  type ProviderStatusUpdate,
} from "./messaging-provider";
import {
  DEFAULT_REMINDER_PREFERENCES,
  mapDbReminderPreference,
  mergeReminderPreferenceWithDefaults,
  type DbReminderPreferenceRow,
} from "./reminder-preferences-data";
import type {
  MessagingAuthorRole,
  MessagingChannelType,
  MessagingConversation,
  MessagingDeliveryStatus,
  MessagingEndpoint,
  MessagingMessage,
  ReminderPreference,
} from "../types";

type InboundProcessInput = {
  providerKey: string;
  channelType: MessagingChannelType;
  participantAddress: string;
  assistantAddress?: string;
  content: string;
  externalMessageId?: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
  dispatchReply?: boolean;
};

type OutboundDispatchInput = {
  conversationId: string;
  content: string;
  providerKey?: string;
  assistantAddress?: string;
};

type DirectEndpointMessageInput = {
  endpoint: MessagingEndpoint;
  content: string;
  providerKey?: string;
  assistantAddress?: string;
  metadata?: Record<string, unknown>;
};

type ConversationWithMessages = {
  conversation: MessagingConversation;
  latestMessage?: MessagingMessage;
};

type VerificationStartResult = {
  endpoint: MessagingEndpoint;
  simulated: boolean;
  simulatedCode?: string;
};

function getAdminSupabase() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return supabase;
}

function messageRoleToHistoryRole(role: MessagingAuthorRole) {
  return role === "assistant" ? "assistant" : "user";
}

function hashVerificationCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isSimulationAllowed() {
  return process.env.NODE_ENV !== "production";
}

function getStatusCallbackUrl(providerKey?: string) {
  if (providerKey !== "twilio") return undefined;
  const value = process.env.TWILIO_STATUS_CALLBACK_URL?.trim();
  return value ? value : undefined;
}

function getDeliveryStatusRank(status: MessagingDeliveryStatus) {
  switch (status) {
    case "received":
    case "processing":
      return 0;
    case "queued":
      return 1;
    case "sent":
      return 2;
    case "delivered":
    case "failed":
      return 3;
    default:
      return 0;
  }
}

function resolveDeliveryStatus(current: MessagingDeliveryStatus, next: MessagingDeliveryStatus) {
  if (current === "delivered" && next !== "delivered") {
    return current;
  }

  if (current === "failed" && next !== "delivered") {
    return current;
  }

  return getDeliveryStatusRank(next) >= getDeliveryStatusRank(current) ? next : current;
}

async function getEndpointByIdForUser(
  supabase: SupabaseClient,
  userId: string,
  endpointId: string,
) {
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("id", endpointId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapDbMessagingEndpoint(data as DbMessagingEndpointRow) : null;
}

async function ensureConversationAssistantSession(
  supabase: SupabaseClient,
  conversation: MessagingConversation,
) {
  const result = await ensureAssistantSession(supabase, conversation.userId, {
    id: conversation.assistantSessionId,
    channel: "messaging",
    title: conversation.title ?? "Messaging assistant thread",
    metadata: {
      messagingConversationId: conversation.id,
      messagingChannelType: conversation.channelType,
    },
  });

  if (conversation.assistantSessionId === result.session.id) {
    return result.session;
  }

  const { error } = await supabase
    .from("messaging_conversations")
    .update({ assistant_session_id: result.session.id })
    .eq("id", conversation.id)
    .eq("user_id", conversation.userId);

  if (error) {
    throw new Error(error.message);
  }

  return result.session;
}

async function findEndpointForInbound(
  supabase: SupabaseClient,
  input: Pick<InboundProcessInput, "channelType" | "participantAddress">,
) {
  const normalizedAddress = normalizeChannelAddress(input.channelType, input.participantAddress);
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("channel_type", input.channelType)
    .eq("address", normalizedAddress)
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapDbMessagingEndpoint(data as DbMessagingEndpointRow) : null;
}

async function findOrCreateConversation(
  supabase: SupabaseClient,
  input: {
    endpoint: MessagingEndpoint;
    channelType: MessagingChannelType;
    providerKey?: string;
    participantAddress: string;
    assistantAddress?: string;
    title?: string;
  },
) {
  const participantAddress = normalizeChannelAddress(input.channelType, input.participantAddress);
  const assistantAddress = input.assistantAddress
    ? normalizeChannelAddress(input.channelType, input.assistantAddress)
    : null;

  const { data: existingRows, error: lookupError } = await supabase
    .from("messaging_conversations")
    .select("*")
    .eq("user_id", input.endpoint.userId)
    .eq("channel_type", input.channelType)
    .eq("participant_address", participantAddress)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const existing = ((existingRows ?? []) as DbMessagingConversationRow[]).find((row) => {
    if (row.status !== "active") return false;
    if ((row.assistant_address ?? null) !== assistantAddress) return false;
    return true;
  });

  if (existing) {
    return mapDbMessagingConversation(existing);
  }

  const { data, error } = await supabase
    .from("messaging_conversations")
    .insert({
      user_id: input.endpoint.userId,
      endpoint_id: input.endpoint.id,
      channel_type: input.channelType,
      provider_key: input.providerKey ?? input.endpoint.providerKey ?? null,
      participant_address: participantAddress,
      assistant_address: assistantAddress,
      status: "active",
      title: input.title ?? (input.channelType === "sms" ? `SMS with ${participantAddress}` : null),
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDbMessagingConversation(data as DbMessagingConversationRow);
}

async function getConversationHistory(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 12,
) {
  const { data, error } = await supabase
    .from("messaging_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbMessagingMessageRow[])
    .reverse()
    .map((row) => mapDbMessagingMessage(row))
    .filter((message) => message.authorRole === "user" || message.authorRole === "assistant")
    .map(
      (message): AssistantHistoryMessage => ({
        role: messageRoleToHistoryRole(message.authorRole),
        content: message.content,
      }),
    );
}

async function insertMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    channelType: MessagingChannelType;
    providerKey?: string;
    providerMessageId?: string;
    direction: "inbound" | "outbound";
    authorRole: MessagingAuthorRole;
    deliveryStatus: MessagingDeliveryStatus;
    content: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    sentAt?: string;
    deliveredAt?: string;
  },
) {
  const { data, error } = await supabase
    .from("messaging_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      channel_type: input.channelType,
      provider_key: input.providerKey ?? null,
      provider_message_id: input.providerMessageId ?? null,
      direction: input.direction,
      author_role: input.authorRole,
      delivery_status: input.deliveryStatus,
      content: input.content,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      attempt_count: input.direction === "outbound" ? 0 : null,
      sent_at: input.sentAt ?? null,
      delivered_at: input.deliveredAt ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDbMessagingMessage(data as DbMessagingMessageRow);
}

async function updateConversationActivity(
  supabase: SupabaseClient,
  conversationId: string,
  timestamp: string,
) {
  const { error } = await supabase
    .from("messaging_conversations")
    .update({ last_message_at: timestamp })
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

async function applyAssistantAction(
  supabase: SupabaseClient,
  userId: string,
  action: Awaited<ReturnType<typeof generateAssistantReply>>["action"],
  assistantContent: string,
) {
  const execution = action
    ? await (async () => {
        const assistantData = await loadAssistantData({
          includeCompletedTasks: true,
          userId,
          supabase,
        });

        return executeAssistantAction({
          supabase,
          userId,
          action,
          assistantContent,
          tasks: assistantData?.tasks ?? [],
          classes: assistantData?.classes ?? [],
          automations: assistantData?.automations ?? [],
          notes: assistantData?.notes ?? [],
          planningItems: assistantData?.planningItems ?? [],
          responseFormat: "plain",
        });
      })()
    : {
        content: assistantContent,
        sync: [],
        status: "skipped" as const,
      };

  return {
    content: execution.content,
    status: execution.status,
  };
}

async function dispatchProviderMessage(
  supabase: SupabaseClient,
  message: MessagingMessage,
  payload: ProviderSendMessageInput,
) {
  const provider = message.providerKey ? getMessagingProvider(message.providerKey) : null;
  if (!provider) {
    const { data, error } = await supabase
      .from("messaging_messages")
      .update({
        delivery_status: "failed",
        error_message: "No messaging provider is configured for this endpoint.",
        attempt_count: 1,
        last_attempted_at: new Date().toISOString(),
        last_error_at: new Date().toISOString(),
      })
      .eq("id", message.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      message: mapDbMessagingMessage(data as DbMessagingMessageRow),
      result: {
        deliveryStatus: "failed",
        errorMessage: "No messaging provider is configured for this endpoint.",
      } satisfies ProviderSendMessageResult,
      };
  }

  const maxAttempts = 2;
  let result: ProviderSendMessageResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptStartedAt = new Date().toISOString();
    const { error: attemptError } = await supabase
      .from("messaging_messages")
      .update({
        attempt_count: attempt,
        last_attempted_at: attemptStartedAt,
      })
      .eq("id", message.id);

    if (attemptError) {
      throw new Error(attemptError.message);
    }

    result = await provider.sendMessage(payload);
    if (!result.shouldRetry || attempt === maxAttempts) {
      break;
    }
  }

  const finalizedResult = result ?? {
    deliveryStatus: "failed",
    errorMessage: "Message dispatch did not produce a provider result.",
  } satisfies ProviderSendMessageResult;

  const finalizedAt = new Date().toISOString();
  const updates: Record<string, unknown> = {
    delivery_status: finalizedResult.deliveryStatus,
    error_message: finalizedResult.errorMessage ?? null,
    provider_last_status: finalizedResult.rawStatus ?? null,
    provider_status_updated_at: finalizedResult.rawStatus ? finalizedAt : null,
  };

  if (finalizedResult.providerMessageId) {
    updates.provider_message_id = finalizedResult.providerMessageId;
  }

  if (finalizedResult.deliveryStatus === "sent" || finalizedResult.deliveryStatus === "queued") {
    updates.sent_at = finalizedAt;
  }

  if (finalizedResult.deliveryStatus === "failed") {
    updates.last_error_at = finalizedAt;
  }

  const { data, error } = await supabase
    .from("messaging_messages")
    .update(updates)
    .eq("id", message.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: mapDbMessagingMessage(data as DbMessagingMessageRow),
    result: finalizedResult,
  };
}

export async function applyProviderStatusUpdate(input: ProviderStatusUpdate) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("messaging_messages")
    .select("*")
    .eq("provider_key", input.providerKey)
    .eq("provider_message_id", input.externalMessageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      found: false as const,
      message: null,
    };
  }

  const existing = mapDbMessagingMessage(data as DbMessagingMessageRow);
  const nextStatus = resolveDeliveryStatus(existing.deliveryStatus, input.deliveryStatus);
  const statusTimestamp = input.occurredAt ?? new Date().toISOString();
  const nextMetadata = {
    ...(existing.metadata ?? {}),
    lastStatusCallback: {
      deliveryStatus: input.deliveryStatus,
      rawStatus: input.rawStatus ?? null,
      occurredAt: statusTimestamp,
      metadata: input.metadata ?? {},
    },
  };

  const { data: updatedRow, error: updateError } = await supabase
    .from("messaging_messages")
    .update({
      delivery_status: nextStatus,
      error_message: nextStatus === "failed" ? input.errorMessage ?? existing.errorMessage ?? null : null,
      delivered_at: nextStatus === "delivered" ? statusTimestamp : existing.deliveredAt ?? null,
      last_error_at: nextStatus === "failed" ? statusTimestamp : existing.lastErrorAt ?? null,
      provider_last_status: input.rawStatus ?? existing.providerLastStatus ?? null,
      provider_status_updated_at: statusTimestamp,
      metadata: nextMetadata,
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if ((existing.metadata?.purpose ?? updatedRow.metadata?.purpose) === "reminder_delivery") {
    const { error: reminderRunError } = await supabase
      .from("reminder_delivery_runs")
      .update({
        delivery_status: nextStatus === "failed" ? "failed" : "sent",
        reason: nextStatus === "failed" ? input.errorMessage ?? existing.errorMessage ?? null : null,
        provider_message_id: input.externalMessageId,
        attempted_at: statusTimestamp,
      })
      .eq("messaging_message_id", existing.id);

    if (reminderRunError) {
      throw new Error(reminderRunError.message);
    }
  }

  return {
    found: true as const,
    message: mapDbMessagingMessage(updatedRow as DbMessagingMessageRow),
  };
}

async function clearPreferredFlagForChannel(
  supabase: SupabaseClient,
  userId: string,
  channelType: MessagingChannelType,
  exceptEndpointId?: string,
) {
  let query = supabase
    .from("messaging_endpoints")
    .update({ is_preferred: false })
    .eq("user_id", userId)
    .eq("channel_type", channelType)
    .eq("is_preferred", true);

  if (exceptEndpointId) {
    query = query.neq("id", exceptEndpointId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

async function ensurePreferredVerifiedEndpoint(
  supabase: SupabaseClient,
  userId: string,
  channelType: MessagingChannelType,
) {
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_type", channelType)
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const endpoints = ((data ?? []) as DbMessagingEndpointRow[]).map(mapDbMessagingEndpoint);
  if (endpoints.length === 0) return;
  if (endpoints.some((endpoint) => endpoint.isPreferred)) return;

  const { error: updateError } = await supabase
    .from("messaging_endpoints")
    .update({ is_preferred: true })
    .eq("id", endpoints[0].id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function getReminderPreferencesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReminderPreference> {
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? mergeReminderPreferenceWithDefaults(
        mapDbReminderPreference(data as DbReminderPreferenceRow),
      )
    : { ...DEFAULT_REMINDER_PREFERENCES, userId };
}

async function sendMessageToEndpoint(
  supabase: SupabaseClient,
  input: DirectEndpointMessageInput,
) {
  if (input.endpoint.verificationStatus !== "verified" || !input.endpoint.isActive) {
    throw new Error("This endpoint must be verified before it can receive messages.");
  }

  const conversation = await findOrCreateConversation(supabase, {
    endpoint: input.endpoint,
    channelType: input.endpoint.channelType,
    providerKey: input.providerKey ?? input.endpoint.providerKey,
    participantAddress: input.endpoint.address,
    assistantAddress: input.assistantAddress,
    title: input.endpoint.channelType === "sms" ? "Assistant text thread" : undefined,
  });

  const queuedMessage = await insertMessage(supabase, {
    conversationId: conversation.id,
    userId: input.endpoint.userId,
    channelType: input.endpoint.channelType,
    providerKey: input.providerKey ?? input.endpoint.providerKey,
    direction: "outbound",
    authorRole: "assistant",
    deliveryStatus: "processing",
    content: input.content,
    metadata: input.metadata,
  });

  const dispatched = await dispatchProviderMessage(supabase, queuedMessage, {
    toAddress: input.endpoint.address,
    fromAddress: input.assistantAddress,
    content: input.content,
    statusCallbackUrl: getStatusCallbackUrl(input.providerKey ?? input.endpoint.providerKey),
  });

  await updateConversationActivity(supabase, conversation.id, new Date().toISOString());
  return {
    conversation,
    message: dispatched.message,
    providerResult: dispatched.result,
  };
}

export async function processInboundMessage(input: InboundProcessInput) {
  const supabase = getAdminSupabase();
  const endpoint = await findEndpointForInbound(supabase, input);

  if (!endpoint) {
    return {
      ok: false as const,
      status: 404,
      error:
        "No active verified messaging endpoint matches that address. Register and verify the student's SMS endpoint before using live inbound messaging.",
    };
  }

  if (input.externalMessageId) {
    const { data: existingMessage, error: existingError } = await supabase
      .from("messaging_messages")
      .select("*")
      .eq("provider_key", input.providerKey)
      .eq("provider_message_id", input.externalMessageId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingMessage) {
      return {
        ok: true as const,
        conversation: null,
        inboundMessage: mapDbMessagingMessage(existingMessage as DbMessagingMessageRow),
        assistantMessage: null,
        duplicate: true,
      };
    }
  }

  const conversation = await findOrCreateConversation(supabase, {
    endpoint,
    channelType: input.channelType,
    providerKey: input.providerKey,
    participantAddress: input.participantAddress,
    assistantAddress: input.assistantAddress,
  });
  const assistantSession = await ensureConversationAssistantSession(supabase, conversation);

  const history = await getConversationHistory(supabase, conversation.id);
  const now = input.receivedAt ?? new Date().toISOString();

  const inboundMessage = await insertMessage(supabase, {
    conversationId: conversation.id,
    userId: endpoint.userId,
    channelType: input.channelType,
    providerKey: input.providerKey,
    providerMessageId: input.externalMessageId,
    direction: "inbound",
    authorRole: "user",
    deliveryStatus: "received",
    content: input.content,
    metadata: input.metadata,
  });

  await supabase
    .from("messaging_endpoints")
    .update({ last_seen_at: now })
    .eq("id", endpoint.id);

  await appendAssistantSessionMessage(supabase, {
    sessionId: assistantSession.id,
    userId: endpoint.userId,
    role: "user",
    contentType: "messaging_text",
    content: input.content,
    metadata: {
      messagingConversationId: conversation.id,
      messagingMessageId: inboundMessage.id,
      channelType: input.channelType,
    },
  });

  await appendAssistantSessionEvent(supabase, {
    sessionId: assistantSession.id,
    userId: endpoint.userId,
    eventType: "message_added",
    metadata: {
      source: "messaging_text",
      messagingConversationId: conversation.id,
    },
  });

  const assistantData = await loadAssistantData({
    includeCompletedTasks: true,
    userId: endpoint.userId,
    supabase,
  });
  const detectedIntent = detectAssistantIntent(input.content, assistantData?.classes ?? []);

  if (detectedIntent === "schedule_setup") {
    const parsedClasses = await parseNaturalLanguageSchedule(
      input.content,
      undefined,
    );

    if (parsedClasses.length > 0) {
      const count = parsedClasses.length;
      let assistantContent = `I parsed ${count} ${count === 1 ? "class" : "classes"} from your message.`;
      let actionStatus: "completed" | "failed" = "failed";

      try {
        const savedSchedule = await saveParsedSchedule({
          supabase,
          userId: endpoint.userId,
          classes: parsedClasses,
        });
        assistantContent = formatScheduleImportResultMessage(savedSchedule, count);
        actionStatus = "completed";
      } catch {
        assistantContent =
          `I parsed ${count} ${count === 1 ? "class" : "classes"} from your message, ` +
          "but I ran into an issue saving them. Please try again from web chat or the Classes page.";
      }

      const queuedMessage = await insertMessage(supabase, {
        conversationId: conversation.id,
        userId: endpoint.userId,
        channelType: conversation.channelType,
        providerKey: input.providerKey,
        direction: "outbound",
        authorRole: "assistant",
        deliveryStatus: input.dispatchReply === false ? "queued" : "processing",
        content: assistantContent,
        metadata: {
          generatedBy: "assistant",
          actionType: "setup_schedule",
          actionStatus,
        },
      });

      await appendAssistantSessionMessage(supabase, {
        sessionId: assistantSession.id,
        userId: endpoint.userId,
        role: "assistant",
        contentType: "text",
        content: assistantContent,
        metadata: {
          messagingConversationId: conversation.id,
          messagingMessageId: queuedMessage.id,
          actionType: "setup_schedule",
          actionStatus,
        },
      });

      await appendAssistantSessionEvent(supabase, {
        sessionId: assistantSession.id,
        userId: endpoint.userId,
        eventType: "assistant_response_generated",
        metadata: {
          actionType: "setup_schedule",
          actionStatus,
        },
      });

      await updateConversationActivity(supabase, conversation.id, now);

      let assistantMessage = queuedMessage;
      let providerResult: ProviderSendMessageResult | null = null;

      if (input.dispatchReply !== false) {
        const dispatched = await dispatchProviderMessage(supabase, queuedMessage, {
          toAddress: conversation.participantAddress ?? endpoint.address,
          fromAddress: conversation.assistantAddress,
          content: assistantContent,
          statusCallbackUrl: getStatusCallbackUrl(input.providerKey ?? conversation.providerKey),
        });
        assistantMessage = dispatched.message;
        providerResult = dispatched.result;
      }

      return {
        ok: true as const,
        conversation,
        inboundMessage,
        assistantMessage,
        providerResult,
      };
    }
  }

  const assistantReply = await generateAssistantReply({
    userId: endpoint.userId,
    message: input.content,
    history,
    currentDatetime: now,
    source: "messaging_text",
    channel: "messaging",
  });

  const actionExecution = await applyAssistantAction(
    supabase,
    endpoint.userId,
    assistantReply.action,
    assistantReply.data.content,
  );
  const assistantContent = actionExecution.content;

  const queuedMessage = await insertMessage(supabase, {
    conversationId: conversation.id,
    userId: endpoint.userId,
    channelType: conversation.channelType,
    providerKey: input.providerKey,
    direction: "outbound",
    authorRole: "assistant",
    deliveryStatus: input.dispatchReply === false ? "queued" : "processing",
    content: assistantContent,
    metadata: {
      generatedBy: "assistant",
      actionType: assistantReply.action?.type,
      actionStatus: actionExecution.status,
    },
  });

  await appendAssistantSessionMessage(supabase, {
    sessionId: assistantSession.id,
    userId: endpoint.userId,
    role: "assistant",
    contentType: "text",
    content: assistantContent,
    metadata: {
      messagingConversationId: conversation.id,
      messagingMessageId: queuedMessage.id,
      actionType: assistantReply.action?.type,
      actionStatus: actionExecution.status,
    },
  });

  await appendAssistantSessionEvent(supabase, {
    sessionId: assistantSession.id,
    userId: endpoint.userId,
    eventType: "assistant_response_generated",
    metadata: assistantReply.action
      ? {
          actionType: assistantReply.action.type,
          actionStatus: actionExecution.status,
        }
      : {},
  });

  await updateConversationActivity(supabase, conversation.id, now);

  let assistantMessage = queuedMessage;
  let providerResult: ProviderSendMessageResult | null = null;

  if (input.dispatchReply !== false) {
    const dispatched = await dispatchProviderMessage(supabase, queuedMessage, {
      toAddress: conversation.participantAddress ?? endpoint.address,
      fromAddress: conversation.assistantAddress,
      content: assistantContent,
      statusCallbackUrl: getStatusCallbackUrl(input.providerKey ?? conversation.providerKey),
    });
    assistantMessage = dispatched.message;
    providerResult = dispatched.result;
  }

  return {
    ok: true as const,
    conversation,
    inboundMessage,
    assistantMessage,
    providerResult,
  };
}

function formatScheduleImportResultMessage(
  result: Awaited<ReturnType<typeof saveParsedSchedule>>,
  parsedCount: number,
) {
  const parts: string[] = [];

  if (result.created.length > 0) {
    parts.push(`added ${result.created.length} ${result.created.length === 1 ? "class" : "classes"}`);
  }
  if (result.updated.length > 0) {
    parts.push(`updated ${result.updated.length} existing ${result.updated.length === 1 ? "class" : "classes"}`);
  }
  if (result.skipped.length > 0) {
    parts.push(`skipped ${result.skipped.length} duplicate ${result.skipped.length === 1 ? "match" : "matches"}`);
  }
  if (result.ambiguous.length > 0) {
    parts.push(`left ${result.ambiguous.length} ambiguous ${result.ambiguous.length === 1 ? "class" : "classes"} unchanged`);
  }

  if (parts.length === 0) {
    return `I parsed ${parsedCount} ${parsedCount === 1 ? "class" : "classes"}, but there was nothing new to save.`;
  }

  const reviewNote =
    result.partial.length > 0
      ? ` ${result.partial.length} ${result.partial.length === 1 ? "class still needs" : "classes still need"} missing schedule details filled in.`
      : "";

  return `Done - I ${parts.join(", ")} in your schedule.${reviewNote}`;
}

export async function sendOutboundConversationMessage(
  input: OutboundDispatchInput,
) {
  const supabase = getAdminSupabase();
  const { data: conversationRow, error: conversationError } = await supabase
    .from("messaging_conversations")
    .select("*")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationError || !conversationRow) {
    throw new Error("Conversation not found.");
  }

  const conversation = mapDbMessagingConversation(conversationRow as DbMessagingConversationRow);
  const message = await insertMessage(supabase, {
    conversationId: conversation.id,
    userId: conversation.userId,
    channelType: conversation.channelType,
    providerKey: input.providerKey ?? conversation.providerKey,
    direction: "outbound",
    authorRole: "assistant",
    deliveryStatus: "processing",
    content: input.content,
  });

  const dispatched = await dispatchProviderMessage(supabase, message, {
    toAddress: conversation.participantAddress ?? "",
    fromAddress: input.assistantAddress ?? conversation.assistantAddress,
    content: input.content,
    statusCallbackUrl: getStatusCallbackUrl(input.providerKey ?? conversation.providerKey),
  });

  await updateConversationActivity(supabase, conversation.id, new Date().toISOString());
  return dispatched.message;
}

export async function listUserConversations(userId: string): Promise<ConversationWithMessages[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("messaging_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const conversations = ((data ?? []) as DbMessagingConversationRow[]).map(mapDbMessagingConversation);
  const results: ConversationWithMessages[] = [];

  for (const conversation of conversations) {
    const { data: latestRows, error: latestError } = await supabase
      .from("messaging_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestError) {
      throw new Error(latestError.message);
    }

    results.push({
      conversation,
      latestMessage: latestRows?.[0]
        ? mapDbMessagingMessage(latestRows[0] as DbMessagingMessageRow)
        : undefined,
    });
  }

  return results;
}

export async function listConversationMessages(conversationId: string, userId: string) {
  const supabase = getAdminSupabase();
  const { data: conversationRow, error: conversationError } = await supabase
    .from("messaging_conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError || !conversationRow || conversationRow.user_id !== userId) {
    throw new Error("Conversation not found.");
  }

  const { data, error } = await supabase
    .from("messaging_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbMessagingMessageRow[]).map(mapDbMessagingMessage);
}

export async function startEndpointVerification(userId: string, endpointId: string): Promise<VerificationStartResult> {
  const supabase = getAdminSupabase();
  const endpoint = await getEndpointByIdForUser(supabase, userId, endpointId);

  if (!endpoint) {
    throw new Error("Messaging endpoint not found.");
  }

  if (endpoint.channelType !== "sms") {
    throw new Error("Only SMS verification is supported right now.");
  }

  const code = createVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const providerKey = endpoint.providerKey ?? "twilio";
  const provider = getMessagingProvider(providerKey);

  let simulated = false;
  let sendResult: ProviderSendMessageResult | null = null;

  if (provider) {
    sendResult = await provider.sendMessage({
      toAddress: endpoint.address,
      content: `${code} is your Student Command Center verification code. It expires in 10 minutes.`,
    });
  }

  if (!provider || sendResult?.deliveryStatus === "failed") {
    if (!isSimulationAllowed()) {
      throw new Error(sendResult?.errorMessage ?? "SMS verification provider is not configured.");
    }
    simulated = true;
  }

  const { data, error } = await supabase
    .from("messaging_endpoints")
    .update({
      provider_key: providerKey,
      is_active: false,
      verification_status: "pending",
      verification_code_hash: hashVerificationCode(code),
      verification_expires_at: expiresAt,
      verification_attempt_count: 0,
      last_verification_sent_at: new Date().toISOString(),
    })
    .eq("id", endpoint.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    endpoint: mapDbMessagingEndpoint(data as DbMessagingEndpointRow),
    simulated,
    simulatedCode: simulated ? code : undefined,
  };
}

export async function confirmEndpointVerification(userId: string, endpointId: string, code: string) {
  const supabase = getAdminSupabase();
  const endpoint = await getEndpointByIdForUser(supabase, userId, endpointId);

  if (!endpoint) {
    throw new Error("Messaging endpoint not found.");
  }

  if (!code.trim()) {
    throw new Error("Verification code is required.");
  }

  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("id", endpointId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Messaging endpoint not found.");
  }

  const row = data as DbMessagingEndpointRow & {
    verification_code_hash?: string | null;
  };

  if (row.verification_status !== "pending" || !row.verification_expires_at || !row.verification_code_hash) {
    throw new Error("Start verification first.");
  }

  if (new Date(row.verification_expires_at).getTime() < Date.now()) {
    await supabase
      .from("messaging_endpoints")
      .update({
        verification_status: "failed",
        verification_code_hash: null,
        verification_expires_at: null,
        verification_attempt_count: 0,
      })
      .eq("id", endpointId)
      .eq("user_id", userId);
    throw new Error("That verification code expired. Request a new one.");
  }

  const nextAttemptCount = (row.verification_attempt_count ?? 0) + 1;
  if (hashVerificationCode(code.trim()) !== row.verification_code_hash) {
    const shouldFail = nextAttemptCount >= 5;
    await supabase
      .from("messaging_endpoints")
      .update({
        verification_attempt_count: nextAttemptCount,
        verification_status: shouldFail ? "failed" : "pending",
      })
      .eq("id", endpointId)
      .eq("user_id", userId);
    throw new Error(
      shouldFail
        ? "Too many incorrect codes. Request a new verification code."
        : "That code didn't match. Double-check it and try again.",
    );
  }

  const { data: preferredExisting, error: preferredError } = await supabase
    .from("messaging_endpoints")
    .select("id")
    .eq("user_id", userId)
    .eq("channel_type", row.channel_type)
    .eq("verification_status", "verified")
    .eq("is_preferred", true)
    .limit(1);

  if (preferredError) {
    throw new Error(preferredError.message);
  }

  const shouldBecomePreferred = (preferredExisting ?? []).length === 0;
  if (shouldBecomePreferred) {
    await clearPreferredFlagForChannel(supabase, userId, row.channel_type);
  }

  const verifiedAt = new Date().toISOString();
  const { data: verifiedRow, error: verifyError } = await supabase
    .from("messaging_endpoints")
    .update({
      is_active: true,
      is_preferred: shouldBecomePreferred ? true : row.is_preferred,
      verification_status: "verified",
      verified_at: verifiedAt,
      verification_code_hash: null,
      verification_expires_at: null,
      verification_attempt_count: 0,
    })
    .eq("id", endpointId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (verifyError) {
    throw new Error(verifyError.message);
  }

  return mapDbMessagingEndpoint(verifiedRow as DbMessagingEndpointRow);
}

export async function setPreferredEndpoint(userId: string, endpointId: string) {
  const supabase = getAdminSupabase();
  const endpoint = await getEndpointByIdForUser(supabase, userId, endpointId);
  if (!endpoint) {
    throw new Error("Messaging endpoint not found.");
  }

  if (endpoint.verificationStatus !== "verified" || !endpoint.isActive) {
    throw new Error("Only verified endpoints can be preferred.");
  }

  await clearPreferredFlagForChannel(supabase, userId, endpoint.channelType, endpoint.id);
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .update({ is_preferred: true })
    .eq("id", endpoint.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDbMessagingEndpoint(data as DbMessagingEndpointRow);
}

export async function sendTestMessageToEndpoint(userId: string, endpointId: string) {
  const supabase = getAdminSupabase();
  const endpoint = await getEndpointByIdForUser(supabase, userId, endpointId);
  if (!endpoint) {
    throw new Error("Messaging endpoint not found.");
  }

  const result = await sendMessageToEndpoint(supabase, {
    endpoint,
    content:
      "This is a test text from your Student Command Center assistant. Your SMS setup is working.",
    metadata: {
      purpose: "test_message",
    },
  });

  return result.message;
}

export async function resolvePreferredSmsEndpoint(userId: string) {
  const supabase = getAdminSupabase();
  await ensurePreferredVerifiedEndpoint(supabase, userId, "sms");

  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_type", "sms")
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("is_preferred", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapDbMessagingEndpoint(data as DbMessagingEndpointRow) : null;
}

export async function resolveReminderDeliveryTarget(userId: string) {
  const supabase = getAdminSupabase();
  const preferences = await getReminderPreferencesForUser(supabase, userId);

  if (preferences.deliveryChannel !== "sms") {
    return {
      preferences,
      endpoint: null,
      channel: "in_app" as const,
    };
  }

  const endpoint = await resolvePreferredSmsEndpoint(userId);
  return {
    preferences,
    endpoint,
    channel: endpoint ? ("sms" as const) : ("in_app" as const),
  };
}

export async function sendReminderMessageToUser(userId: string, content: string) {
  const supabase = getAdminSupabase();
  const target = await resolveReminderDeliveryTarget(userId);

  if (target.channel !== "sms" || !target.endpoint) {
    return {
      delivered: false,
      channel: "in_app" as const,
      reason: "No verified preferred SMS endpoint is available.",
    };
  }

  const result = await sendMessageToEndpoint(supabase, {
    endpoint: target.endpoint,
    content,
    metadata: {
      purpose: "reminder_delivery",
    },
  });

  return {
    delivered: true,
    channel: "sms" as const,
    message: result.message,
  };
}
