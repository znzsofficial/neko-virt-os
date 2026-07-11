import { create } from "zustand";
import type { Notification } from "./types";
import { nanoid } from "nanoid";

type NotificationStore = {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

const notificationTimers = new Map<string, number>();

function clearNotificationTimer(id: string) {
  const timer = notificationTimers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    notificationTimers.delete(id);
  }
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (n) => {
    const id = nanoid(6);
    const createdAt = Date.now();
    const duplicateKey = `${n.type ?? "info"}:${n.title}:${n.message}`;
    const duplicateIds = useNotificationStore.getState().notifications
      .filter((item) => `${item.type ?? "info"}:${item.title}:${item.message}` === duplicateKey)
      .map((item) => item.id);
    duplicateIds.forEach(clearNotificationTimer);
    set((state) => ({
      notifications: [
        ...state.notifications.filter((item) => `${item.type ?? "info"}:${item.title}:${item.message}` !== duplicateKey),
        { ...n, id, createdAt, progress: 1 },
      ].slice(-5),
    }));
    if (n.duration !== 0) {
      const timer = window.setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((item) => item.id !== id),
        }));
        notificationTimers.delete(id);
      }, n.duration ?? 3500);
      notificationTimers.set(id, timer);
    }
  },
  removeNotification: (id) => {
    clearNotificationTimer(id);
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },
  clearNotifications: () => {
    notificationTimers.forEach((_, id) => clearNotificationTimer(id));
    set({ notifications: [] });
  },
}));
