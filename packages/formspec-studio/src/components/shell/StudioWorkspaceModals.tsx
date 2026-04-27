/** @filedesc Shared modal layer: palette, import, form settings, app settings (Shell + assistant workspace).
 *
 * Overlay z-index map (increase only with intention):
 * - Assistant orientation scrim: z-30
 * - Assistant mobile sheet scrim: z-40
 * - Command palette: z-50
 * - Confirm (replace project): z-[55]
 */
import { CommandPalette } from '../CommandPalette';
import { ImportDialog } from '../ImportDialog';
import { SettingsDialog } from '../SettingsDialog';
import { AppSettingsDialog } from '../AppSettingsDialog';

export interface StudioWorkspaceModalsProps {
  showPalette: boolean;
  setShowPalette: (show: boolean) => void;
  showImport: boolean;
  setShowImport: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAppSettings: boolean;
  setShowAppSettings: (show: boolean) => void;
  importOnBeforeLoad?: () => boolean | Promise<boolean>;
  /** Runs after the import dialog closes (in addition to `setShowImport(false)`). */
  onImportClosed?: () => void;
  commandPaletteSurface?: 'studio' | 'assistant';
}

export function StudioWorkspaceModals({
  showPalette,
  setShowPalette,
  showImport,
  setShowImport,
  showSettings,
  setShowSettings,
  showAppSettings,
  setShowAppSettings,
  importOnBeforeLoad,
  onImportClosed,
  commandPaletteSurface = 'studio',
}: StudioWorkspaceModalsProps) {
  return (
    <>
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        surface={commandPaletteSurface}
      />
      <ImportDialog
        open={showImport}
        onClose={() => {
          setShowImport(false);
          onImportClosed?.();
        }}
        onBeforeLoad={importOnBeforeLoad}
      />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <AppSettingsDialog open={showAppSettings} onClose={() => setShowAppSettings(false)} />
    </>
  );
}
