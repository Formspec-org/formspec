/** @filedesc Resizable horizontal split-pane layout component with a draggable divider. */
import { useState, useRef, useEffect, ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialSplit?: number; // percentage 0-100
  minLeft?: number; // pixels
  minRight?: number; // pixels
  className?: string;
}

/**
 * A simple horizontal split pane with a draggable divider.
 */
export function SplitPane({
  left,
  right,
  initialSplit = 50,
  minLeft = 100,
  minRight = 100,
  className = ""
}: SplitPaneProps) {
  const [split, setSplit] = useState(initialSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newSplit = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Apply constraints
      const leftPx = (newSplit / 100) * containerRect.width;
      const rightPx = containerRect.width - leftPx;

      if (leftPx >= minLeft && rightPx >= minRight) {
        setSplit(newSplit);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, minLeft, minRight]);

  return (
    <div 
      ref={containerRef} 
      className={`flex w-full h-full border border-border/40 rounded-xl overflow-hidden bg-subtle/10 ${className}`}
    >
      <div 
        style={{ width: `${split}%` }} 
        className="h-full overflow-hidden flex flex-col flex-shrink-0 min-w-0"
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={`w-1.5 h-full cursor-col-resize hover:bg-accent/30 transition-colors flex-shrink-0 flex items-center justify-center group ${
          isDragging ? 'bg-accent/40' : 'bg-border/20'
        }`}
      >
        <div className={`w-[1px] h-8 bg-border/60 group-hover:bg-accent/60 ${isDragging ? 'bg-accent/60' : ''}`} />
      </div>

      <div 
        style={{ width: `${100 - split}%` }} 
        className="h-full overflow-hidden flex flex-col flex-grow min-w-0"
      >
        {right}
      </div>
    </div>
  );
}
