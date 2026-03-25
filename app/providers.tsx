"use client";

import { TaskStoreProvider } from "../lib/task-store";
import { ReminderStoreProvider } from "../lib/reminder-store";
import { ClassStoreProvider } from "../lib/stores/classStore";
import { ScheduleConfigProvider } from "../lib/stores/scheduleConfig";
import { CalendarStoreProvider } from "../lib/stores/calendarStore";
import { AutomationStoreProvider } from "../lib/stores/automationStore";
import { AuthProvider } from "../lib/auth-context";
import { ThemeProvider } from "../lib/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClassStoreProvider>
          <ScheduleConfigProvider>
            <CalendarStoreProvider>
              <TaskStoreProvider>
                <ReminderStoreProvider>
                  <AutomationStoreProvider>{children}</AutomationStoreProvider>
                </ReminderStoreProvider>
              </TaskStoreProvider>
            </CalendarStoreProvider>
          </ScheduleConfigProvider>
        </ClassStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
