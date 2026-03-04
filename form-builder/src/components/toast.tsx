import { toasts } from '../state/toast';

export function ToastContainer() {
    const items = toasts.value;
    if (items.length === 0) return null;

    return (
        <div class="toast-container">
            {items.map((toast) => (
                <div key={toast.id} class={`toast ${toast.type}${toast.leaving ? ' leaving' : ''}`}>
                    <span class="toast-icon">
                        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
                    </span>
                    {toast.message}
                </div>
            ))}
        </div>
    );
}
