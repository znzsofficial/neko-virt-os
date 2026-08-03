import { create } from "zustand";

export type AppDialogKind = "confirm" | "alert" | "prompt";

export type AppDialogRequest = {
  id: string;
  kind: AppDialogKind;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: boolean | string | null) => void;
};

type DialogStore = {
  queue: AppDialogRequest[];
  current: AppDialogRequest | null;
  enqueue: (request: Omit<AppDialogRequest, "id" | "resolve">) => Promise<boolean | string | null>;
  settle: (value: boolean | string | null) => void;
};

let nextId = 1;

function promote(set: (partial: Partial<DialogStore> | ((state: DialogStore) => Partial<DialogStore>)) => void, get: () => DialogStore) {
  const state = get();
  if (state.current || !state.queue.length) return;
  const [head, ...rest] = state.queue;
  set({ current: head ?? null, queue: rest });
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  queue: [],
  current: null,
  enqueue: (request) =>
    new Promise((resolve) => {
      const item: AppDialogRequest = {
        ...request,
        id: `dlg-${nextId++}`,
        resolve,
      };
      set((state) => ({ queue: [...state.queue, item] }));
      promote(set, get);
    }),
  settle: (value) => {
    const state = get();
    const current = state.current;
    if (!current) return;
    current.resolve(value);
    const [next, ...queue] = state.queue;
    set({ current: next ?? null, queue });
  },
}));

export async function appConfirm(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  const result = await useDialogStore.getState().enqueue({
    kind: "confirm",
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
    danger: options.danger,
  });
  return result === true;
}

export async function appAlert(options: {
  title: string;
  message: string;
  confirmLabel?: string;
}): Promise<void> {
  await useDialogStore.getState().enqueue({
    kind: "alert",
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel,
  });
}

export async function appPrompt(options: {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<string | null> {
  const result = await useDialogStore.getState().enqueue({
    kind: "prompt",
    title: options.title,
    message: options.message,
    defaultValue: options.defaultValue,
    placeholder: options.placeholder,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
  });
  return typeof result === "string" ? result : null;
}
