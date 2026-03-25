import { isBeforeToday, isToday } from "./datetime";
import type { StudentTask } from "../types";

export type TaskDisplayBuckets = {
  overdue: StudentTask[];
  today: StudentTask[];
  upcoming: StudentTask[];
  noDueDate: StudentTask[];
};

export function sortTasksByDueDate(tasks: StudentTask[]) {
  return [...tasks].sort((firstTask, secondTask) => {
    if (!firstTask.dueAt && !secondTask.dueAt) {
      return 0;
    }

    if (!firstTask.dueAt) {
      return 1;
    }

    if (!secondTask.dueAt) {
      return -1;
    }

    return new Date(firstTask.dueAt).getTime() - new Date(secondTask.dueAt).getTime();
  });
}

export function getIncompleteTasks(tasks: StudentTask[]) {
  return tasks.filter((task) => task.status !== "done");
}

export function filterTasksByClassId(tasks: StudentTask[], classId?: string) {
  if (!classId) {
    return tasks;
  }

  return tasks.filter((task) => task.classId === classId);
}

// TODO: Once user timezone preference exists, pass it here instead of relying on browser local time.
export function groupTasksByDisplayBucket(tasks: StudentTask[]): TaskDisplayBuckets {
  const buckets: TaskDisplayBuckets = {
    overdue: [],
    today: [],
    upcoming: [],
    noDueDate: [],
  };

  for (const task of tasks) {
    if (!task.dueAt) {
      buckets.noDueDate.push(task);
      continue;
    }

    if (isToday(task.dueAt)) {
      buckets.today.push(task);
      continue;
    }

    if (isBeforeToday(task.dueAt)) {
      buckets.overdue.push(task);
      continue;
    }

    buckets.upcoming.push(task);
  }

  return buckets;
}
