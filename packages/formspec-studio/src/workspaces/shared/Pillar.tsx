/** @filedesc Reusable pillar wrapper for workspace sections with title, subtitle, accent bar, and content area. */
import { HelpTip } from '../../components/ui/HelpTip';

interface PillarProps {
  title: string;
  subtitle: string;
  helpText: string;
  children: React.ReactNode;
  accentColor?: string;
  hidden?: boolean;
  'data-testid'?: string;
}

export function Pillar({
  title,
  subtitle,
  helpText,
  children,
  accentColor = 'bg-accent',
  hidden = false,
  'data-testid': testId,
}: PillarProps) {
  return (
    <div
      data-testid={testId}
      className={`mb-12 last:mb-0 group animate-in fade-in slide-in-from-bottom-2 duration-500 ${hidden ? 'hidden' : ''}`}
    >
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-1 h-5 rounded-full ${accentColor}`} />
          <h3 className="font-mono text-[13px] font-bold tracking-[0.2em] uppercase text-ink">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <HelpTip text={helpText}>
            <span className="text-[12px] text-muted italic tracking-tight">{subtitle}</span>
          </HelpTip>
        </div>
      </header>
      <div className="pl-6 border-l border-border/60 ml-0.5 mt-4">
        {children}
      </div>
    </div>
  );
}
