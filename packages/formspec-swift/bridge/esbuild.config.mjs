/**
 * esbuild config for the formspec-swift JS bridge.
 *
 * Bundles dispatcher.ts + all imports into a single IIFE, inlines the runtime
 * WASM binary as base64 into wasm-bridge-runtime.js, and writes the result to
 * the Swift package Resources HTML.
 *
 * The WASM binary is embedded so the HTML file is fully self-contained — no
 * external fetch required inside WKWebView.
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const ENGINE_DIR = resolve(REPO_ROOT, 'packages/formspec-engine');
const WASM_RUNTIME_PATH = resolve(ENGINE_DIR, 'wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm');

// ---------------------------------------------------------------------------
// WASM bridge patch plugin
//
// Intercepts wasm-bridge-runtime.js and replaces its content with a version
// that inlines the WASM binary as base64 rather than fetching via URL.
// This makes the bundle fully self-contained for WKWebView.
// ---------------------------------------------------------------------------

const wasmBridgePatchPlugin = {
    name: 'wasm-bridge-patch',
    setup(build) {
        const wasmBridgeRuntimePath = resolve(ENGINE_DIR, 'dist/wasm-bridge-runtime.js');

        build.onLoad({ filter: /wasm-bridge-runtime\.js$/ }, (args) => {
            if (args.path !== wasmBridgeRuntimePath) return null;

            // Read and base64-encode the WASM binary
            const wasmBytes = readFileSync(WASM_RUNTIME_PATH);
            const b64 = wasmBytes.toString('base64');

            // Read the original file
            let src = readFileSync(args.path, 'utf-8');

            // Inject the base64 WASM at the top of the module
            const wasmInjectCode = `
// --- WASM inline injection (formspec-swift bridge build) ---
function _decodeWasmBase64() {
    const b64 = "${b64}";
    const bstr = atob(b64);
    const bytes = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
    return bytes.buffer;
}
const _INLINE_WASM_BUFFER = _decodeWasmBase64();
// -----------------------------------------------------------
`;

            // Replace the browser init path to use inline bytes instead of URL fetch
            // Original:
            //   else if (typeof runtime.default === 'function') {
            //       await runtime.default({
            //           module_or_path: new URL('../wasm-pkg-runtime/formspec_wasm_runtime_bg.wasm', import.meta.url),
            //       });
            //   }
            src = src.replace(
                /else if \(typeof runtime\.default === 'function'\) \{\s*await runtime\.default\(\{[^}]*\}\);\s*\}/,
                `else if (typeof runtime.default === 'function') {
                await runtime.default({ module_or_path: _INLINE_WASM_BUFFER });
            }`
            );

            return { contents: wasmInjectCode + src, loader: 'js' };
        });

        // Also shim import.meta.url in wasm-bridge-shared.js (Node fallback) and
        // wasm-pkg-runtime glue so they don't break when import.meta is empty.
        build.onLoad({ filter: /wasm-bridge-shared\.js$/ }, (args) => {
            let src = readFileSync(args.path, 'utf-8');
            src = src.replace(/import\.meta\.url/g, '"https://formspec.local/"');
            return { contents: src, loader: 'js' };
        });

        build.onLoad({ filter: /wasm-pkg-runtime[/\\]formspec_wasm_runtime\.js$/ }, (args) => {
            let src = readFileSync(args.path, 'utf-8');
            src = src.replace(/import\.meta\.url/g, '"https://formspec.local/"');
            return { contents: src, loader: 'js' };
        });

        build.onLoad({ filter: /wasm-pkg-tools[/\\]formspec_wasm_tools\.js$/ }, (args) => {
            let src = readFileSync(args.path, 'utf-8');
            src = src.replace(/import\.meta\.url/g, '"https://formspec.local/"');
            return { contents: src, loader: 'js' };
        });
    },
};

async function build() {
    const result = await esbuild.build({
        entryPoints: [resolve(__dirname, 'dispatcher.ts')],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        write: false,
        minify: true,
        sourcemap: false,
        plugins: [wasmBridgePatchPlugin],
        alias: {
            'formspec-engine/render': resolve(ENGINE_DIR, 'dist/engine-render-entry.js'),
            '@preact/signals-core': resolve(REPO_ROOT, 'node_modules/@preact/signals-core/dist/signals-core.module.js'),
        },
    });

    if (result.errors.length > 0) {
        console.error('Build errors:', result.errors);
        process.exit(1);
    }

    const jsCode = result.outputFiles[0].text;
    const template = readFileSync(resolve(__dirname, 'template.html'), 'utf-8');
    const html = template.replace(
        '<!-- BRIDGE_SCRIPT_PLACEHOLDER -->',
        `<script>${jsCode}</script>`
    );

    const outPath = resolve(__dirname, '../Sources/FormspecSwift/Resources/formspec-engine.html');
    writeFileSync(outPath, html, 'utf-8');
    console.log(`Bridge bundle written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
