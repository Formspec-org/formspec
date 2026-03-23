/** @filedesc Node helpers to resolve sibling `.wasm` bytes when `import.meta.url` is not `file:` (e.g. Vitest). */

export const nodeFsModuleName = 'node:fs';
export const nodeUrlModuleName = 'node:url';
export const nodePathModuleName = 'node:path';
export const nodeModuleModuleName = 'node:module';

/**
 * Resolve a sibling `.wasm` path for Node `readFileSync`.
 * Vitest/vite-node can rewrite `import.meta.url` to a non-`file:` URL; fall back to the `formspec-engine` package root.
 */
export async function resolveWasmAssetPathForNode(relativeToThisModule: string): Promise<string> {
    const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrlModuleName);
    const { dirname, join } = await import(/* @vite-ignore */ nodePathModuleName);
    const { createRequire } = await import(/* @vite-ignore */ nodeModuleModuleName);

    const meta = import.meta.url;
    if (meta.startsWith('file:')) {
        return fileURLToPath(new URL(relativeToThisModule, meta));
    }

    try {
        const require = createRequire(join(process.cwd(), 'package.json'));
        const engineRoot = dirname(require.resolve('formspec-engine/package.json'));
        const tail = relativeToThisModule.replace(/^\.\.\//, '');
        return join(engineRoot, tail);
    } catch {
        const tail = relativeToThisModule.replace(/^\.\.\//, '');
        return join(process.cwd(), '..', 'formspec-engine', tail);
    }
}
