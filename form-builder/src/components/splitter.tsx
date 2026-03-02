import { signal } from '@preact/signals';

export function Splitter({ onResize }: { onResize: (deltaX: number) => void }) {
  const dragging = signal(false);

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault();
    dragging.value = true;
    let lastX = event.clientX;

    function handleMouseMove(nextEvent: MouseEvent) {
      const deltaX = nextEvent.clientX - lastX;
      lastX = nextEvent.clientX;
      onResize(deltaX);
    }

    function handleMouseUp() {
      dragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <div
      class={`studio-splitter ${dragging.value ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDblClick={() => {
        onResize(0);
      }}
    />
  );
}
