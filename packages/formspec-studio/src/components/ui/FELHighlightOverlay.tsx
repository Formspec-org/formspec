import React from 'react';

export interface FELHighlightToken {
  key: string;
  text: string;
  kind: 'keyword' | 'path' | 'function' | 'literal' | 'operator' | 'plain';
}

interface FELHighlightOverlayProps {
  tokens: FELHighlightToken[];
  placeholder?: string;
}

export function FELHighlightOverlay({ tokens, placeholder }: FELHighlightOverlayProps) {
  return (
    <div 
      className="absolute inset-0 z-20 pointer-events-none font-mono text-[14px] px-2 py-1.5 whitespace-pre-wrap break-all select-none overflow-hidden leading-relaxed"
      aria-hidden="true"
    >
      {tokens.length === 0 && placeholder && (
        <span className="text-muted">{placeholder}</span>
      )}
      {tokens.map((token, i) => (
        <span 
          key={`${token.key}-${i}`} 
          className={`
            ${token.kind === 'keyword' ? 'text-accent font-bold' : ''}
            ${token.kind === 'path' ? 'text-green' : ''}
            ${token.kind === 'function' ? 'text-logic font-semibold underline decoration-logic/20 underline-offset-2' : ''}
            ${token.kind === 'literal' ? 'text-amber' : ''}
            ${token.kind === 'operator' ? 'text-muted' : ''}
            ${token.kind === 'plain' ? 'text-ink/80' : ''}
          `}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}
