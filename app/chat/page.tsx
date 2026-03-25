// UI redesign pass
import { ChatPanel } from "../../components/ChatPanel";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const initialQuery =
    typeof params?.q === "string" ? params.q.slice(0, 500) : undefined;

  return (
    // Full viewport height — the chat panel owns the scroll, not the page
    <main className="flex h-screen flex-col overflow-hidden">
      {/* Dark header — matches dashboard hero */}
      <div className="shrink-0 bg-hero px-8 py-5">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            {/* Assistant avatar dot */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/20 text-sm text-sidebar-accent">
              ✦
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">
                Your AI Assistant
              </h1>
              <p className="text-xs text-sidebar-text">
                Ask about your week, workload, upcoming tests, or what to tackle tonight
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-col px-6">
          <ChatPanel initialQuery={initialQuery} />
        </div>
      </div>
    </main>
  );
}
