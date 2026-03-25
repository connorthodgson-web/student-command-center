"use client";

import { TaskStoreProvider } from "../lib/task-store";
import { ReminderStoreProvider } from "../lib/reminder-store";
import { ClassStoreProvider } from "../lib/stores/classStore";
import { ScheduleConfigProvider } from "../lib/stores/scheduleConfig";
import { AuthProvider } from "../lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClassStoreProvider>
        <ScheduleConfigProvider>
          <TaskStoreProvider>
            <ReminderStoreProvider>{children}</ReminderStoreProvider>
          </TaskStoreProvider>
        </ScheduleConfigProvider>
      </ClassStoreProvider>
    </AuthProvider>
  );
}
