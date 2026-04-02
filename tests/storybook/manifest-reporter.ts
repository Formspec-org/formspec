/** @filedesc Custom Vitest reporter — writes manifest.json and per-story DOM snapshots alongside screenshots. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Reporter, TestCase, TestModule } from 'vitest/reporters';

const CWD = process.cwd();
const MANIFEST = path.join(CWD, 'storybook-manifest.json');

interface ManifestRow {
    id: string;
    title?: string;
    name?: string;
    png: string;
    dom: string;
    consoleErrors: string[];
    ok: boolean;
}

interface DomWrite {
    absPath: string;
    content: string;
}

export default class ManifestReporter implements Reporter {
    private rows: ManifestRow[] = [];
    private domWrites: DomWrite[] = [];

    onTestCaseResult(testCase: TestCase): void {
        const meta = testCase.meta() as Record<string, unknown>;
        const storyId = meta.storyId as string | undefined;
        if (!storyId) return;

        const result = testCase.result();
        const errors: string[] = [];
        if (result.state === 'failed' && result.errors) {
            for (const err of result.errors) {
                errors.push(err.message ?? String(err));
            }
        }

        const safeId = storyId.replace(/[^a-zA-Z0-9-]+/g, '_');

        // Co-locate DOM snapshot with screenshot baselines in __screenshots__/
        // testCase.module.moduleId is the absolute path to the .stories.tsx file
        const storyFilePath = testCase.module.moduleId;
        const storyDir = path.dirname(storyFilePath);
        const storyFile = path.basename(storyFilePath);
        const ssDir = path.join(storyDir, '__screenshots__', storyFile);
        const domFile = `${safeId}.dom.txt`;
        const domAbsPath = path.join(ssDir, domFile);
        const domRelPath = path.relative(CWD, domAbsPath);

        const domContent = meta.domSnapshot as string | undefined;
        if (domContent) {
            this.domWrites.push({ absPath: domAbsPath, content: domContent });
        }

        // Screenshot path (matches toMatchScreenshot naming convention)
        const pngRelPath = path.relative(CWD,
            path.join(ssDir, `${safeId}-chromium-darwin.png`));

        this.rows.push({
            id: storyId,
            title: meta.componentName as string | undefined,
            name: testCase.name,
            png: pngRelPath,
            dom: domRelPath,
            consoleErrors: errors,
            ok: result.state === 'passed',
        });
    }

    async onTestRunEnd(_modules: ReadonlyArray<TestModule>): Promise<void> {
        if (this.rows.length === 0) return;

        this.rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));

        // Write DOM snapshots alongside screenshots
        const dirs = new Set(this.domWrites.map((w) => path.dirname(w.absPath)));
        await Promise.all([...dirs].map((d) => mkdir(d, { recursive: true })));
        await Promise.all(
            this.domWrites.map(({ absPath, content }) =>
                writeFile(absPath, content, 'utf8'),
            ),
        );

        // Write manifest at repo root
        await writeFile(
            MANIFEST,
            `${JSON.stringify({
                generatedAt: new Date().toISOString(),
                count: this.rows.length,
                stories: this.rows,
            }, null, 2)}\n`,
            'utf8',
        );
    }
}
