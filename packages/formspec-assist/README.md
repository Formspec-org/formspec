# @formspec-org/assist

Reference implementation of the [Formspec Assist Specification](../../specs/assist/assist-spec.md) — a transport-agnostic interoperability contract for software that helps people complete forms.

## What It Does

Assist exposes a structured tool catalog over a live Formspec form. An agent, browser extension, accessibility tool, or chat layer can:

- **Introspect** — discover fields, pages, progress, and live validation state.
- **Get help** — resolve contextual references, ontology concepts, and semantic equivalents for any field.
- **Mutate** — set field values individually or in bulk, with readonly/relevance guards.
- **Autofill** — match a user profile against form fields by ontology concept identity, then apply values with optional human-in-the-loop confirmation.
- **Navigate** — find the next incomplete field or page.

The protocol is LLM-independent, transport-neutral, and additive — it does not alter core Formspec processing semantics.

## Quick Start

```typescript
import { createAssistProvider } from '@formspec-org/assist';
import { FormEngine, initFormspecEngine } from '@formspec-org/engine';

await initFormspecEngine();

const engine = new FormEngine(definition);
const provider = createAssistProvider({ engine });

// Introspect
const tools = provider.getTools();
const progress = await provider.invokeTool('formspec.form.progress', {});

// Get field help (references + ontology)
const help = await provider.invokeTool('formspec.field.help', {
  path: 'organization.ein',
  audience: 'agent',
});

// Set a value
const result = await provider.invokeTool('formspec.field.set', {
  path: 'organization.ein',
  value: '12-3456789',
});
```

## Tool Catalog

| Tool | Category | Description |
|------|----------|-------------|
| `formspec.form.describe` | Introspection | Form metadata and status |
| `formspec.field.list` | Introspection | List fields with filter (`all`, `required`, `empty`, `invalid`, `relevant`) |
| `formspec.field.describe` | Introspection | Field state, validation, widget hint, repeat metadata, and help |
| `formspec.field.help` | Introspection | Resolve references and ontology for a field |
| `formspec.form.progress` | Introspection | Required/filled/valid counts and page progress |
| `formspec.field.set` | Mutation | Set a single field value |
| `formspec.field.bulkSet` | Mutation | Set multiple field values |
| `formspec.form.validate` | Validation | Full validation report (`continuous` or `submit` mode) |
| `formspec.field.validate` | Validation | Field-scoped validation results |
| `formspec.profile.match` | Profile | Match profile values to form fields by concept identity |
| `formspec.profile.apply` | Profile | Apply matched values with optional confirmation |
| `formspec.profile.learn` | Profile | Save form values to profile by concept identity |
| `formspec.form.pages` | Navigation | Page-level progress |
| `formspec.form.nextIncomplete` | Navigation | Next incomplete field or page |

## Configuration

```typescript
const provider = createAssistProvider({
  engine,                        // Required — live FormEngine instance
  references: referencesDoc,     // ReferencesDocument or ReferencesDocument[]
  ontology: ontologyDoc,         // OntologyDocument or OntologyDocument[]
  component: componentDoc,       // ComponentDocument (for page resolution)
  theme: themeDoc,               // ThemeDocument (for page resolution)
  profile: userProfile,          // UserProfile for autofill
  registries: [registryDoc],     // RegistryDocument[] or RegistryEntry[]
  storage: localStorage,         // StorageBackend for profile persistence
  profileMatchThreshold: 0.5,    // Minimum confidence for profile matches
  confirmProfileApply: (req) =>  // Human-in-the-loop confirmation handler
    confirm(`Apply ${req.matches.length} values?`),
  registerWebMCP: true,          // Register tools on navigator.modelContext
});
```

## Sidecar Documents

Assist resolves field context from two companion document types:

- **References** — contextual help entries (documentation, examples, regulations) bound to field paths. Entries are filtered by audience (`human`, `agent`, `both`) and sorted by priority (`primary` > `supplementary` > `background`).
- **Ontology** — semantic concept bindings that give fields stable identity across forms. Powers cross-form autofill via profile matching.

Both target a specific definition URL and optional version range. Multiple documents of each type are supported; references merge additively, ontology uses last-loaded-wins for conflicts.

## Architecture

```
┌─────────────────────────────────────────────┐
│  AssistProvider                              │
│  ├── Tool Catalog (14 tools)                │
│  ├── ContextResolver (references + ontology)│
│  ├── ProfileMatcher (concept-based autofill) │
│  ├── ProfileStore (persistent storage)       │
│  └── WebMCP shim (browser registration)      │
└─────────────────────────────────────────────┘
         │
         ▼
┌──────────────┐  ┌───────────────┐
│  FormEngine  │  │  Layout       │
│  (layer 1)   │  │  (layer 1)    │
└──────────────┘  └───────────────┘
```

The package sits between the engine layer and consumer-facing transports. It depends on `formspec-engine` (form state), `formspec-layout` (page resolution), and `formspec-types` (shared type vocabulary).

## Testing

```bash
# From package directory
npx vitest run

# With verbose output
npx vitest run --reporter=verbose

# Watch mode
npx vitest
```

65 tests across 5 files covering all 14 tools, error codes, profile workflows, sidecar resolution, page navigation, repeat groups, and WebMCP discovery.
