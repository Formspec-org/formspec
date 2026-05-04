/** @filedesc Composition root that nests all shell context providers. */
import { type ReactNode } from 'react';
import { ColorSchemeProvider } from './ColorSchemeProvider';
import { ShellLayoutProvider } from './ShellLayoutProvider';
import { ShellPanelsProvider } from './ShellPanelsProvider';
import { WorkspaceRouterProvider } from './WorkspaceRouterProvider';
import { EditorStateProvider } from './EditorStateProvider';

export function ShellProviders({ children }: { children: ReactNode }) {
  return (
    <ColorSchemeProvider>
      <ShellLayoutProvider>
        <ShellPanelsProvider>
          <WorkspaceRouterProvider>
            <EditorStateProvider>
              {children}
            </EditorStateProvider>
          </WorkspaceRouterProvider>
        </ShellPanelsProvider>
      </ShellLayoutProvider>
    </ColorSchemeProvider>
  );
}
