import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { createProject, type AnyCommand, type Project } from 'formspec-studio-core';
import { ProjectProvider } from '../state/ProjectContext';
import { SelectionProvider } from '../state/useSelection';
import { ActivePageProvider } from '../state/useActivePage';
import { Shell } from '../components/Shell';
import { exampleDefinition } from '../fixtures/example-definition';
import type { InquestHandoffPayloadV1 } from '../shared/contracts/inquest';
import { deleteHandoffPayload, loadBootstrapProject, loadHandoffPayload, saveBootstrapProject } from '../shared/persistence/inquest-store';
import { inquestPath } from '../shared/transport/routes';

export function createStudioProject(seed?: Parameters<typeof createProject>[0]): Project {
  return createProject(seed ?? { seed: { definition: exampleDefinition as any } });
}

interface StudioAppProps {
  project?: Project;
}

function normalizeBindExpression(expression: string): string {
  if (expression === 'true()') return 'true';
  if (expression === 'false()') return 'false';
  return expression;
}

function normalizeBinds(binds: unknown): Array<{ path: string; entries: Record<string, string> }> {
  if (Array.isArray(binds)) {
    return binds.map((bind: any) => ({
      path: bind.path,
      entries: Object.fromEntries(
        Object.entries(bind ?? {})
          .filter((entry): entry is [string, string] => entry[0] !== 'path' && typeof entry[1] === 'string')
          .map(([key, value]) => [key, normalizeBindExpression(value)]),
      ) as Record<string, string>,
    }));
  }

  return Object.entries((binds as Record<string, Record<string, string>>) ?? {}).map(([path, entries]) => ({
    path,
    entries: Object.fromEntries(
      Object.entries(entries ?? {}).map(([key, value]) => [key, normalizeBindExpression(value)]),
    ) as Record<string, string>,
  }));
}

function resolveImportedPath(path: string, targetGroupPath?: string, keyPrefix?: string): string {
  const [root, ...rest] = path.split('.');
  const prefixedRoot = keyPrefix ? `${keyPrefix}${root}` : root;
  return [targetGroupPath, prefixedRoot, ...rest].filter(Boolean).join('.');
}

function buildImportSubformCommands(payload: InquestHandoffPayloadV1): AnyCommand[] {
  const definition = payload.scaffold.definition as Record<string, any>;
  const keyPrefix = payload.target?.keyPrefix;
  const targetGroupPath = payload.target?.groupPath;
  const commands: AnyCommand[] = [
    {
      type: 'project.importSubform',
      payload: {
        definition,
        targetGroupPath,
        keyPrefix,
      },
    },
  ];

  normalizeBinds(definition.binds).forEach((bind) => {
    commands.push({
      type: 'definition.setBind',
      payload: {
        path: resolveImportedPath(bind.path, targetGroupPath, keyPrefix),
        properties: bind.entries,
      },
    });
  });

  return commands;
}

function applyInquestProvenance(project: Project, payload: InquestHandoffPayloadV1): void {
  project.dispatch({
    type: 'definition.setDefinitionProperty',
    payload: {
      property: 'x-inquest',
      value: {
        sessionId: payload.inquest.sessionId,
        templateId: payload.inquest.templateId,
        workflowMode: payload.inquest.workflowMode,
        providerId: payload.inquest.providerId,
        analysisSummary: payload.inquest.analysisSummary,
        proposalSummary: payload.inquest.proposalSummary,
        issues: payload.inquest.issues,
        importedAt: payload.createdAt,
      },
    },
  });
}

export function StudioApp({ project }: StudioAppProps = {}): ReactElement {
  const [activeProject] = useState<Project>(() => project ?? createStudioProject());
  const [banner, setBanner] = useState<string | null>(null);
  const [projectRevision, setProjectRevision] = useState(0);

  useEffect(() => activeProject.onChange(() => {
    setProjectRevision((current) => current + 1);
  }), [activeProject]);

  useEffect(() => {
    let disposed = false;

    async function applyHandoffFromLocation() {
      const params = new URLSearchParams(window.location.search);
      const handoffId = params.get('h');
      if (!handoffId) return;

      const payload = await loadHandoffPayload(handoffId);
      if (!payload) {
        if (!disposed) setBanner('Inquest handoff could not be loaded from local storage.');
        return;
      }

      const hasBlockingOpenIssues = payload.inquest.workflowMode === 'verify-carefully'
        && payload.inquest.issues.some((issue) => issue.blocking && issue.status !== 'resolved');

      if (hasBlockingOpenIssues) {
        if (!disposed) setBanner('Inquest handoff is blocked until the verify-carefully issues are resolved.');
        return;
      }

      try {
        if (payload.mode === 'new-project') {
          activeProject.dispatch({
            type: 'project.import',
            payload: payload.scaffold,
          });
        } else {
          if (!payload.target?.projectId) {
            throw new Error('Import-subform handoff is missing the originating Studio project.');
          }

          const hostProject = await loadBootstrapProject(payload.target.projectId);
          if (!hostProject) {
            throw new Error('The originating Studio project is not available on this browser.');
          }

          const stagedProject = createProject({ seed: hostProject });
          const importCommands = buildImportSubformCommands(payload);
          stagedProject.batch(importCommands);
          const diagnostics = stagedProject.diagnose();
          const hasBlockingDiagnostics = [
            ...diagnostics.structural,
            ...diagnostics.expressions,
            ...diagnostics.extensions,
            ...diagnostics.consistency,
          ].some((issue) => issue.severity === 'error');

          if (hasBlockingDiagnostics) {
            throw new Error('The imported subform failed Studio validation during staging.');
          }

          activeProject.dispatch({
            type: 'project.import',
            payload: hostProject,
          });
          activeProject.batch(importCommands);
        }

        applyInquestProvenance(activeProject, payload);
        await deleteHandoffPayload(handoffId);
        params.delete('h');
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
        if (!disposed) {
          setBanner(`Inquest handoff applied from session ${payload.inquest.sessionId}.`);
        }
      } catch (error) {
        if (!disposed) {
          setBanner(error instanceof Error ? error.message : 'Inquest handoff failed.');
        }
      }
    }

    void applyHandoffFromLocation();
    return () => {
      disposed = true;
    };
  }, [activeProject]);

  const inquestSessionId = useMemo(
    () => ((activeProject.definition as any)['x-inquest'] as { sessionId?: string } | undefined)?.sessionId,
    [activeProject, projectRevision],
  );

  const appMenuItems = useMemo(() => ([
    {
      label: 'New Inquest',
      testId: 'app-menu-new-inquest',
      onClick: async () => {
        const projectId = crypto.randomUUID();
        await saveBootstrapProject(projectId, activeProject.export());
        window.location.assign(inquestPath(undefined, `mode=import-subform&bootstrap=${encodeURIComponent(projectId)}`));
      },
    },
    ...(inquestSessionId ? [{
      label: 'Reopen Inquest',
      testId: 'app-menu-reopen-inquest',
      onClick: () => window.location.assign(inquestPath(inquestSessionId)),
    }] : []),
  ]), [activeProject, inquestSessionId]);

  return (
    <ProjectProvider project={activeProject}>
      <SelectionProvider>
        <ActivePageProvider>
          <Shell appMenuItems={appMenuItems} banner={banner} />
        </ActivePageProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}
