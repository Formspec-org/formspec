import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import type { ProjectState } from '../../state/project';
import {
  createPreviewSyncMessage,
  isPreviewReadyMessage,
  type PreviewArtifacts
} from './messages';

const PREVIEW_FRAME_SRC = import.meta.env.MODE === 'test' ? 'about:blank' : '/preview-frame.html';

export interface PreviewPaneProps {
  project: ProjectState;
  previewWidth: number;
  activeBreakpoint: string;
}

export function PreviewPane(props: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const readyRef = useRef(false);
  const latestArtifactsRef = useRef<PreviewArtifacts | null>(null);
  const pendingArtifactsRef = useRef<PreviewArtifacts | null>(null);

  const artifacts = useMemo<PreviewArtifacts>(() => serializePreviewArtifacts(props.project), [props.project]);

  const flushPendingSync = useCallback(() => {
    if (!readyRef.current || !pendingArtifactsRef.current) {
      return;
    }

    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) {
      return;
    }

    iframeWindow.postMessage(createPreviewSyncMessage(pendingArtifactsRef.current), '*');
    pendingArtifactsRef.current = null;
  }, []);

  useEffect(() => {
    latestArtifactsRef.current = artifacts;
    pendingArtifactsRef.current = artifacts;
    flushPendingSync();
  }, [artifacts, flushPendingSync]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (!isPreviewReadyMessage(event.data)) {
        return;
      }

      readyRef.current = true;
      flushPendingSync();
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [flushPendingSync]);

  return (
    <section class="preview-pane surface-card" data-testid="preview-pane">
      <header class="preview-pane__header">
        <p>Live preview</p>
        <span class="preview-pane__size" data-testid="preview-size-label">
          {props.activeBreakpoint} · {props.previewWidth}px
        </span>
      </header>
      <div class="preview-pane__viewport">
        <div
          class="preview-pane__canvas"
          data-testid="preview-canvas"
          style={{ width: `${props.previewWidth}px` }}
        >
          <iframe
            ref={(element) => {
              iframeRef.current = element;
            }}
            class="preview-pane__frame"
            title="Form preview"
            src={PREVIEW_FRAME_SRC}
            sandbox="allow-forms allow-scripts allow-same-origin"
            data-testid="preview-iframe"
            onLoad={() => {
              readyRef.current = false;
              pendingArtifactsRef.current = latestArtifactsRef.current;
            }}
          />
        </div>
      </div>
    </section>
  );
}

function serializePreviewArtifacts(project: ProjectState): PreviewArtifacts {
  return {
    definition: structuredClone(project.definition),
    component: structuredClone(project.component),
    theme: structuredClone(project.theme)
  };
}
