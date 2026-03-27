import { NextResponse } from "next/server";
import { getMessagingProvider } from "../../../../../lib/messaging-provider";
import { processInboundMessage } from "../../../../../lib/messaging-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerKey } = await context.params;
  const provider = getMessagingProvider(providerKey);

  if (!provider) {
    return NextResponse.json({ error: "Unsupported messaging provider." }, { status: 404 });
  }

  try {
    const inbound = await provider.parseInboundRequest(request);
    const result = await processInboundMessage({
      ...inbound,
      dispatchReply: true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbound messaging failed.";
    const status = message.includes("signature") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
