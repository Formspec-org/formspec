/** @filedesc Read-only tree view of the form's response schema derived from the item hierarchy. */
import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useOptionalSelection } from '../../state/useSelection';

interface SchemaNodeProps {
  item: any;
  depth: number;
  path: string;
  isSelected: boolean;
  onSelect: (path: string, type: string) => void;
}

function SchemaNode({ item, depth, path, isSelected, onSelect }: SchemaNodeProps) {
  const isGroup = item.type === 'group';
  const typeLabel = isGroup 
    ? (item.repeatable ? 'array' : 'object') 
    : (item.dataType || item.type);
  
  const [isExpanded, setIsExpanded] = useState(true);

  const displayLabel = item.label || item.key;

  return (
    <div className="font-mono text-[13px] leading-relaxed">
      <div 
        className={`group flex items-center gap-2 py-0.5 px-2 rounded-md transition-colors cursor-pointer ${isSelected ? 'bg-accent/10 border-l-2 border-accent ml-[-2px]' : 'hover:bg-subtle/50'}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path, item.type);
        }}
      >
        <span className="text-muted/40 w-4 select-none">
          {isGroup && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="hover:text-ink transition-colors"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </span>

        <span className="text-orange-600 font-bold">"{item.key}"</span>
        <span className="text-muted">:</span>
        
        <span className="inline-flex items-center px-1.5 py-0 rounded bg-subtle text-[10px] font-bold uppercase tracking-tight text-muted/80 border border-border/50">
          {typeLabel}
        </span>

        {item.required && (
          <span className="text-[10px] font-bold text-error/70 uppercase tracking-tighter">*required</span>
        )}

        {displayLabel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(path, item.type);
            }}
            className="text-muted/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[200px] text-[11px] italic hover:text-accent cursor-pointer"
          >
            {displayLabel}
          </button>
        )}
      </div>

      {isGroup && isExpanded && item.children && (
        <div className="ml-4 pl-4 border-l border-border/40 space-y-0.5 mt-0.5">
          {item.children.map((child: any) => (
            <SchemaNode 
              key={child.key} 
              item={child} 
              depth={depth + 1} 
              path={`${path}.${child.key}`} 
              isSelected={false} // Selection logic needs to be globally handled or passed down
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ResponseSchema() {
  const definition = useDefinition();
  const selection = useOptionalSelection();
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const items = definition?.items ?? [];

  const selectPath = (path: string, type: string) => {
    setLocalSelected(path);
    selection?.select(path, type);
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-6 shadow-sm min-h-[400px]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <h4 className="text-[11px] font-bold text-muted uppercase tracking-[0.2em]">Output Blueprint</h4>
        </div>
        <div className="text-[11px] text-muted font-mono italic">
          // Final JSON structure generated on submit
        </div>
      </div>

      <div className="space-y-1 font-mono text-[13px]">
        <div className="text-muted">{'{'}</div>
        <div className="ml-4 space-y-4">
          {/* Metadata Sections (Simplified) */}
          <div className="opacity-50 space-y-1">
            <div><span className="text-orange-600">"definitionUrl"</span><span className="text-muted">:</span> <span className="text-blue-600">"string"</span><span className="text-muted">,</span></div>
            <div><span className="text-orange-600">"status"</span><span className="text-muted">:</span> <span className="text-blue-600">"enum"</span><span className="text-muted">,</span></div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-600 font-bold">"data"</span><span className="text-muted">: {'{'}</span>
            </div>
            
            <div className="ml-4 space-y-1 border-l border-accent/20 pl-4 py-1">
              {items.length === 0 ? (
                <div className="text-muted/40 italic text-xs">// No fields defined yet</div>
              ) : (
                items.map((item) => (
                  <SchemaNode 
                    key={item.key} 
                    item={item} 
                    depth={0} 
                    path={item.key} 
                    isSelected={(selection?.selectedKey ?? localSelected) === item.key}
                    onSelect={selectPath}
                  />
                ))
              )}
            </div>
            
            <div className="text-muted mt-1">{'}'}</div>
          </div>
          
          <div className="opacity-50">
            <div><span className="text-orange-600">"validationResults"</span><span className="text-muted">:</span> <span className="text-blue-600">"array"</span></div>
          </div>
        </div>
        <div className="text-muted">{'}'}</div>
      </div>
    </div>
  );
}
