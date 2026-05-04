/** @filedesc Premium splash screen rendered during engine initialization to prevent white flash. */
import { type ReactElement } from 'react';
import { IconSparkle } from './icons';

export function SplashScreen(): ReactElement {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#fcfcf9] dark:bg-[#0b0b0e] transition-colors duration-500">
      <div className="relative flex flex-col items-center space-y-8 animate-fade-in">
        <div className="relative">
          <div className="w-24 h-24 rounded-[2.5rem] bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-inner animate-pulse-subtle">
            <IconSparkle size={48} />
          </div>
          <div className="absolute -inset-4 bg-accent/10 rounded-full blur-3xl -z-10 animate-pulse" />
        </div>
        
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-display font-bold tracking-tight text-ink">
            Formspec Studio
          </h1>
          <div className="flex items-center justify-center gap-1.5 h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-12 text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
        Initializing Document Manifest
      </div>
    </div>
  );
}
