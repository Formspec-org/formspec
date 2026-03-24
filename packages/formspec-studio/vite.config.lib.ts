// Library build config — produces dist/formspec-studio.js + .css
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const packagesRoot = path.resolve(__dirname, '..');

// Stub plugin: replaces the WASM bridge with no-ops since we don't
// have wasm-pack built and the WASM module is optional at runtime.
function stubWasm(): Plugin {
  const wasmBridgePath = path.resolve(packagesRoot, 'formspec-engine/src/wasm-bridge.ts');
  const wasmRuntimePath = path.resolve(packagesRoot, 'formspec-engine/src/fel/wasm-runtime.ts');
  const wasmPkgPattern = /formspec-engine\/wasm-pkg\//;

  return {
    name: 'stub-wasm',
    enforce: 'pre' as const,
    resolveId(source, importer) {
      // Intercept any import from/within the wasm-pkg directory
      if (wasmPkgPattern.test(source) || (importer && wasmPkgPattern.test(importer))) {
        return '\0wasm-stub';
      }
      if (source.endsWith('.wasm')) {
        return '\0wasm-stub';
      }
      return null;
    },
    load(id) {
      if (id === '\0wasm-stub' || id.endsWith('.wasm')) {
        // Export stubs for all WASM functions that formspec-engine/wasm-bridge.ts might use
        return `
          export default {};
          export function __wbg_set_wasm() {}
          export function analyzeFEL() { return null; }
          export function assembleDefinition() { return null; }
          export function collectFELRewriteTargets() { return null; }
          export function detectDocumentType() { return null; }
          export function evalFEL() { return null; }
          export function evalFELWithContext() { return null; }
          export function evaluateDefinition() { return null; }
          export function executeMapping() { return null; }
          export function executeMappingDoc() { return null; }
          export function extractDependencies() { return null; }
          export function findRegistryEntry() { return null; }
          export function generateChangelog() { return null; }
          export function getFELDependencies() { return null; }
          export function itemAtPath() { return null; }
          export function itemLocationAtPath() { return null; }
          export function jsonPointerToJsonPath() { return null; }
          export function lintDocument() { return null; }
          export function lintDocumentWithRegistries() { return null; }
          export function listBuiltinFunctions() { return null; }
          export function normalizeIndexedPath() { return null; }
          export function parseFEL() { return null; }
          export function parseRegistry() { return null; }
          export function planSchemaValidation() { return null; }
          export function printFEL() { return null; }
          export function rewriteFELReferences() { return null; }
          export function rewriteMessageTemplate() { return null; }
          export function validateExtensionUsage() { return null; }
          export function validateLifecycleTransition() { return null; }
          export function wellKnownRegistryUrl() { return null; }
        `;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stubWasm(), react(), tailwindcss()],
  define: { 'process.env': JSON.stringify({}) },
  resolve: {
    alias: {
      'formspec-studio-core': path.resolve(packagesRoot, 'formspec-studio-core/src/index.ts'),
      'formspec-core': path.resolve(packagesRoot, 'formspec-core/src/index.ts'),
      'formspec-types': path.resolve(packagesRoot, 'formspec-types/src/index.ts'),
      'formspec-engine': path.resolve(packagesRoot, 'formspec-engine/src/index.ts'),
      'formspec-layout': path.resolve(packagesRoot, 'formspec-layout/src/index.ts'),
      'formspec-chat': path.resolve(packagesRoot, 'formspec-chat/src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib.ts'),
      name: 'FormspecStudio',
      formats: ['es'],
      fileName: 'formspec-studio',
    },
    rollupOptions: {
      // Don't bundle React — host app provides it
      external: ['react', 'react-dom', 'react/jsx-runtime', 'node:fs', 'node:url'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});
