# ADR 0053 — formspec-kotlin: Android/Compose Form Renderer

**Status:** Accepted
**Date:** 2026-03-25
**Relates to:** `thoughts/specs/2026-03-25-formspec-swift-design.md` (Kotlin/Compose section)

## Context

`formspec-swift` (ADR implied by spec, implemented 2026-03-25) establishes the pattern for native mobile form rendering: a hidden WebView runs formspec-engine + WASM, communicating via a typed JSON message protocol with batched events. Observable state objects bridge engine signals to framework-native reactivity.

Android needs the same capability. The question is whether to share code across platforms (KMP, Compose Multiplatform) or build a separate idiomatic package.

## Decision

Build `formspec-kotlin` as a **separate Kotlin package** mirroring `formspec-swift`'s architecture, not a shared KMP module.

### Architecture

Same three-layer design as `formspec-swift`:

| Layer | Swift | Kotlin |
|-------|-------|--------|
| **Bridge** | Hidden `WKWebView` | Hidden Android `WebView` |
| **State** | `@Observable` classes | Compose `State<T>` / `StateFlow<T>` |
| **Renderer** | SwiftUI `View` protocols | `@Composable` function types |

### Shared artifacts

The **HTML bundle** (`formspec-engine.html`) and **message protocol** (EngineCommand/EngineEvent JSON shapes) are identical across platforms. The same `bridge/dispatcher.ts` and `bridge/esbuild.config.mjs` from `formspec-swift` produce the bundle. The Kotlin package should reference or copy this artifact rather than maintaining a second build.

### Key API mappings

| Concept | Swift | Kotlin |
|---------|-------|--------|
| Engine factory | `static func create(bundle:) async throws` | `suspend fun create(bundle): FormspecEngine` |
| Main thread | `@MainActor` | `Dispatchers.Main` |
| Field state | `@Observable class FieldState` | `class FieldState` with `State<T>` properties |
| Form state | `@Observable class FormState` | `class FormState` with `State<T>` properties |
| Non-Compose consumers | N/A | `StateFlow<T>` exposure |
| Field component | `protocol FieldComponent: View` | `typealias FieldComponent = @Composable (FieldState, LayoutNode) -> Unit` |
| Layout component | `protocol LayoutComponent: View` | `typealias LayoutComponent = @Composable (LayoutNode, @Composable () -> Unit) -> Unit` |
| Component map | `struct ComponentMap` | `data class ComponentMap` |
| Auto-renderer | `struct FormspecForm: View` | `@Composable fun FormspecForm(engine, components)` |
| Stability | `@Observable` (implicit) | `@Stable` on `FieldState`, `FormState`; `@Immutable` on `LayoutNode` |

### WebView bridge differences

| Concern | iOS (WKWebView) | Android (WebView) |
|---------|-----------------|-------------------|
| JS → Native | `WKScriptMessageHandler` | `@JavascriptInterface` |
| Native → JS | `evaluateJavaScript` | `evaluateJavascript` |
| WASM loading | Inline base64 | Inline base64 (same) |
| Thread model | MainActor-isolated | `Looper.getMainLooper()` |
| Process crash | `webViewWebContentProcessDidTerminate` | `onRenderProcessGone` |
| Resource loading | `Bundle.module` | `assets/` directory |

### Minimum API level

**API 26 (Android 8.0)** — WebView supports WASM from Chrome 57+ (ships with API 26+), and `onRenderProcessGone` (needed for crash recovery) requires API 26. This covers 97%+ of active devices.

**Compose:** Requires Jetpack Compose 1.5+ / Compose BOM 2024+. The library ships Compose compiler plugin compatibility metadata via `build.gradle.kts`.

### Package structure

```
packages/formspec-kotlin/
├── build.gradle.kts                    # Android library + Compose compiler
├── settings.gradle.kts                 # Standalone Gradle project
├── consumer-rules.pro                  # ProGuard keep rules for @JavascriptInterface
├── src/main/
│   ├── AndroidManifest.xml             # Minimal (no permissions required)
│   ├── kotlin/org/formspec/kotlin/
│   │   ├── types/          # JSONValue, LayoutNode, RenderingBundle
│   │   ├── bridge/         # EngineCommand, EngineEvent, WebViewEngine
│   │   ├── state/          # FieldState, FormState, FormspecEngine
│   │   ├── renderer/       # ComponentMap, FormspecForm
│   │   └── components/     # Default Compose components
│   └── assets/
│       └── formspec-engine.html  # Same bundle as Swift
├── src/test/                     # Unit tests (JUnit 5)
└── src/androidTest/              # Instrumented tests (WebView needs Activity)
```

**Maven coordinates:** `org.formspec:formspec-kotlin`. Published to Maven Central when stable.

### Android lifecycle concerns

**Configuration changes:** The hidden `WebView` must survive Activity recreation (rotation, locale, dark mode). `WebViewEngine` should be scoped to a `ViewModel` (or `AndroidViewModel(application)`) — not tied to Activity/Fragment lifecycle. The `FormspecEngine` public API is lifecycle-agnostic; lifecycle scoping is the consumer's responsibility.

**Background/foreground:** Call `WebView.onPause()` / `WebView.onResume()` when the app goes to background/foreground to save battery and reduce memory pressure. `FormspecEngine` should expose `pause()` / `resume()` methods that delegate to the WebView.

**Renderer process death:** Android can kill the WebView renderer process under memory pressure. `onRenderProcessGone` (API 26+) detects this. Recovery strategy mirrors Swift: attempt one automatic reload of the bridge with the same bundle. If recovery fails, surface `FormspecError.bridgeDisconnected`.

**ProGuard/R8:** The `@JavascriptInterface` methods must not be obfuscated. The library ships `consumer-rules.pro` with `-keepclassmembers` rules for the bridge interface.

**Network access:** The hidden WebView loads a local `file:///android_asset/` HTML file and does not require `INTERNET` permission for basic operation. If the form definition includes `choicesFrom` with a URL, the consumer must grant network permission separately.

### Why not KMP / Compose Multiplatform

1. **Rust crates are the shared layer.** FEL, validation, coercion — all normative logic is in Rust, compiled to WASM. Adding a KMP layer on top is a second bridge for no gain.
2. **The platform binding is thin.** The per-platform code (signal→Observable, WebView lifecycle) is ~500 lines. Sharing it via KMP adds more complexity than it saves.
3. **iOS developers expect Swift packages.** Android developers expect Gradle/Maven. Each ecosystem has packaging, testing, and IDE conventions that KMP would fight.
4. **Compose Multiplatform kills the component map story.** The value of formspec is "bring your own components." CMP forces everyone into Compose; SwiftUI developers can't use their own views.

### Future direction

Same as Swift: when the WebView bridge is proven, migrate to **native Rust FFI via UniFFI**. UniFFI generates both Swift and Kotlin bindings from the same `.udl` definition — the Rust-native migration is actually where KMP-like code sharing becomes natural, at the FFI layer rather than the UI layer.

## Consequences

- A new `formspec-kotlin` package is created with its own Gradle build, Compose UI layer, and test suite.
- The HTML bundle build script (`formspec-swift/bridge/`) should be extracted to a shared location (e.g., `packages/formspec-bridge/`) so both Swift and Kotlin reference it.
- The message protocol JSON shapes are a de facto contract — changes require updating both packages.
- Android instrumented tests (which need a real `WebView` in an `Activity`) parallel the macOS E2E tests in `formspec-swift`.
