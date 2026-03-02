import { toasts } from '../state/toast';

export function ToastContainer() {
  return (
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.value.map((toast) => (
        <div key={toast.id} class={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
