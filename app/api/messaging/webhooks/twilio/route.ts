import { NextResponse } from "next/server";
import { getMessagingProvider } from "../../../../../lib/messaging-provider";
import { applyProviderStatusUpdate, processInboundMessage } from "../../../../../lib/messaging-service";

export async function POST(request: Request) {
  const provider = getMessagingProvider("twilio");
  if (!provider) {
    return NextResponse.json({ error: "Twilio messaging provider is not available." }, { status: 503 });
  }

  try {
    const statusUpdate = provider.parseStatusCallback
      ? await provider.parseStatusCallback(request.clone())
      : null;

    if (statusUpdate) {
      const result = await applyProviderStatusUpdate(statusUpdate);
      return NextResponse.json(
        {
          ok: true,
          kind: "status",
          matched: result.found,
          messageId: result.message?.id ?? null,
          deliveryStatus: result.message?.deliveryStatus ?? null,
        },
        { status: 200 },
      );
    }

    const inbound = await provider.parseInboundRequest(request);
    const result = await processInboundMessage({
      providerKey: inbound.providerKey,
      channelType: inbound.channelType,
      participantAddress: inbound.participantAddress,
      assistantAddress: inbound.assistantAddress,
      content: inbound.content,
      externalMessageId: inbound.externalMessageId,
      receivedAt: inbound.receivedAt,
      metadata: inbound.metadata,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        ok: true,
        kind: "inbound",
        duplicate: Boolean(result.duplicate),
        conversationId: result.conversation?.id ?? null,
        inboundMessageId: result.inboundMessage?.id ?? null,
        assistantMessageId: result.assistantMessage?.id ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Twilio webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
