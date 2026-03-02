import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;
export const toasts = signal<Toast[]>([]);

export function showToast(message: string, type: Toast['type'] = 'info') {
  const id = nextId;
  nextId += 1;
  toasts.value = [...toasts.value, { id, message, type }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, 2800);
}
