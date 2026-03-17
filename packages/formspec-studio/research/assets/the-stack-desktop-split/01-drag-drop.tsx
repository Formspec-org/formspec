/** @filedesc Research prototype: drag-and-drop primitives (DragHandle, DropIndicator, useDragReorder). */
// DRAG & DROP
// Split from the-stack-desktop.tsx — prototype, imports not wired.
import { useState, useCallback } from "react";

function DragHandle(props) {
  return (
    <div {...props} style={{ cursor: "grab", display: "flex", alignItems: "center", padding: "2px 3px", opacity: 0.35, flexShrink: 0, borderRadius: 2, transition: "opacity 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
      onMouseLeave={e => e.currentTarget.style.opacity = 0.35}>
      <svg width="8" height="14" viewBox="0 0 8 14" fill={co.mu}><circle cx="2" cy="2" r="1.1"/><circle cx="6" cy="2" r="1.1"/><circle cx="2" cy="6" r="1.1"/><circle cx="6" cy="6" r="1.1"/><circle cx="2" cy="10" r="1.1"/><circle cx="6" cy="10" r="1.1"/></svg>
    </div>
  );
}

function DropIndicator({ active }) {
  return <div style={{ height: active ? 2 : 0, margin: active ? "2px 0" : 0, background: co.ac, borderRadius: 1, transition: "all 0.12s", opacity: active ? 1 : 0 }} />;
}

function useDragReorder(listKey) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const onDragStart = useCallback((idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${listKey}:${idx}`);
    // Transparent drag image
    const el = document.createElement("div");
    el.style.opacity = "0";
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 0, 0);
    setTimeout(() => document.body.removeChild(el), 0);
  }, [listKey]);

  const onDragOver = useCallback((idx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragIdx) setOverIdx(idx);
  }, [dragIdx]);

  const onDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const onDrop = useCallback((idx, reorderFn) => (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    const [key, fromStr] = data.split(":");
    if (key === listKey) {
      const from = parseInt(fromStr);
      if (from !== idx && !isNaN(from)) reorderFn(from, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [listKey]);

  return { dragIdx, overIdx, onDragStart, onDragOver, onDragEnd, onDrop };
}


