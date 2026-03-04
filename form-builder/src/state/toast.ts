import { signal } from '@preact/signals';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    leaving?: boolean;
}

let nextToastId = 0;

export const toasts = signal<Toast[]>([]);

export function showToast(message: string, type: ToastType = 'info') {
    const id = nextToastId++;
    toasts.value = [...toasts.value, { id, message, type }];

    setTimeout(() => {
        toasts.value = toasts.value.map((t) =>
            t.id === id ? { ...t, leaving: true } : t,
        );
        setTimeout(() => {
            toasts.value = toasts.value.filter((t) => t.id !== id);
        }, 200);
    }, 3000);
}
