import { StudioWorkspaceModals, type StudioWorkspaceModalsProps } from './StudioWorkspaceModals';

export type ShellDialogsProps = Omit<
  StudioWorkspaceModalsProps,
  'importOnBeforeLoad' | 'onImportClosed'
>;

export function ShellDialogs(props: ShellDialogsProps) {
  return <StudioWorkspaceModals {...props} />;
}
