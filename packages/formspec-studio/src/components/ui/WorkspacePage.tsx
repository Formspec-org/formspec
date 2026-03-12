import { ReactNode } from 'react';

interface WorkspacePageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  maxWidth?: string;
}

/**
 * Standard container for workspace tabs.
 * Enforces a centered document feel with a max-width and vertical centering.
 */
export function WorkspacePage({ 
  children, 
  className = "", 
  maxWidth = "max-w-[660px]",
  ...props 
}: WorkspacePageProps) {
  return (
    <div 
      className={`flex flex-col min-h-full ${maxWidth} mx-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface WorkspacePageSectionProps {
  children: ReactNode;
  className?: string;
  padding?: string;
}

/**
 * Standard horizontal padding for content within WorkspacePage.
 */
export function WorkspacePageSection({ 
  children, 
  className = "", 
  padding = "px-7" 
}: WorkspacePageSectionProps) {
  return (
    <div className={`${padding} ${className}`}>
      {children}
    </div>
  );
}
