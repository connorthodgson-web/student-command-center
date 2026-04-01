import { ChatPageContent } from "../../components/ChatPageContent";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tutor?: string }>;
}) {
  const params = await searchParams;
  const initialQuery =
    typeof params?.q === "string" ? params.q.slice(0, 500) : undefined;
  const openTutoring = params?.tutor === "true";

  return (
    // h-dvh: full dynamic viewport height on mobile — dvh shrinks when the keyboard
    // opens on iOS/Android, keeping the input visible. The ChatPanel renders an
    // internal bottom spacer (md:hidden) to clear the fixed bottom nav bar.
    // md:h-[calc(100dvh-56px)]: on desktop, Nav.tsx uses a sticky in-flow top bar
    // (h-14 = 56px), so we subtract it so the chat fills exactly the remaining viewport.
    <main className="flex flex-col overflow-hidden h-dvh md:h-[calc(100dvh-56px)]">
      <ChatPageContent initialQuery={initialQuery} openTutoring={openTutoring} />
    </main>
  );
}
