export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

type ToastListener = (toasts: ToastItem[]) => void;

let activeToasts: ToastItem[] = [];
const toastListeners = new Set<ToastListener>();

function notifyListeners(): void {
  for (const listener of toastListeners) {
    listener([...activeToasts]);
  }
}

export function toast(message: string, variant: ToastVariant = 'success'): void {
  const id = Math.random().toString(36).slice(2, 9);
  activeToasts = [...activeToasts, { id, message, variant }];
  notifyListeners();
  window.setTimeout(() => {
    activeToasts = activeToasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 4000);
}

export function subscribeToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  listener([...activeToasts]);
  return (): void => {
    toastListeners.delete(listener);
  };
}
