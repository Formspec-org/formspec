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
      className={`mb-16 last:mb-0 group ${hidden ? 'hidden' : ''}`}
    >
      <header className="mb-6 flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className={`w-1 h-5 rounded-sm ${accentColor} opacity-90`} />
            <h3 className="text-[18px] font-bold tracking-tight text-ink">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 pl-4">
            <span className="text-[13px] text-muted font-bold tracking-tight opacity-70">{subtitle}</span>
            <HelpTip text={helpText}>
              <button className="flex h-4 w-4 items-center justify-center rounded bg-subtle text-[9px] font-bold text-muted hover:bg-accent/10 hover:text-accent transition-all cursor-help">
                ?
              </button>
            </HelpTip>
          </div>
        </div>
      </header>
      <div className="pl-4 border-l-2 border-border/10 ml-0.5 transition-all duration-300 group-hover:border-accent/20">
        {children}
      </div>
    </div>
  );
}
