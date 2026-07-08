import { create } from "zustand";
import type { Notification } from "./types";
import { nanoid } from "nanoid";

type NotificationStore = {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (n) => {
    const id = nanoid(6);
    set((state) => ({
      notifications: [...state.notifications, { ...n, id }],
    }));
    if (n.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((item) => item.id !== id),
        }));
      }, n.duration ?? 3500);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
}));
