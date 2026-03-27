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
    // h-[calc(100dvh-52px)]: subtracts the mobile top bar (~52px) so the chat fills
    // exactly the remaining visible viewport without overflowing behind it.
    // md:h-dvh: on desktop the sidebar is fixed so the full dynamic viewport height is correct.
    // dvh (dynamic viewport height) shrinks when the keyboard opens on iOS, keeping
    // the input visible above the keyboard.
    <main className="flex flex-col overflow-hidden h-[calc(100dvh-52px)] md:h-dvh">
      <ChatPageContent initialQuery={initialQuery} openTutoring={openTutoring} />
    </main>
  );
}
