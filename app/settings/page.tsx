import { ReminderSettingsCard } from "../../components/ReminderSettingsCard";
import { SectionHeader } from "../../components/SectionHeader";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <SectionHeader
        title="Settings"
        description="Reminder preferences matter early because the assistant should eventually help students stay on top of school without making the app feel noisy."
      />

      <ReminderSettingsCard />
    </main>
  );
}
