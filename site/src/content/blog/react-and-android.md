---
title: "One form definition, every platform: React and Android join the runtime family"
description: "Formspec forms now render natively in React web apps and Android/Compose apps. Same JSON definition, same validation rules, same behavior — your form managers define a form once and it ships everywhere without rebuilding."
date: 2026-03-26
tags: ["announcement", "react", "android", "architecture"]
author: "Michael Deeb & Claude"
---

You've spent three months getting a 200-field grant application through compliance review. The definition is locked. Validation rules are tested. WCAG compliance is verified. Now your agency needs the same form in three places: the main web portal (React), the field office Android tablets, and the existing government site that runs the `<formspec-render>` web component.

In most form systems, that's three separate implementations. Three codebases to maintain. Three sets of validation rules to keep in sync. Three rounds of accessibility testing. Three chances for the budget calculation to produce different results on different platforms.

Today we're shipping **formspec-react** for React web applications and announcing **formspec-kotlin** for Android/Jetpack Compose. React is live now; Kotlin's architecture is finalized (ADR accepted) with implementation underway. Combined with the existing web component and the formspec-swift package for iOS/SwiftUI, Formspec forms will run natively on every major platform — from the same JSON definition.

## What "same definition, every platform" actually means

This isn't "write once, run anywhere" in the Java sense. Each platform has its own native rendering package with idiomatic components. What's shared is the form definition — the JSON document that encodes your fields, validation rules, conditional logic, and calculated values — and the [Rust shared kernel](/blog/rust-shared-kernel) that evaluates it identically everywhere.

A grant manager locks a form definition at version 2.1.0. That same `grant-report-v2.1.0.json` file loads into:

- **formspec-react** — React hooks bind to the engine; a `<FormspecForm>` auto-renderer walks the layout tree into React elements
- **formspec-kotlin** — Compose `@Composable` functions render the same layout tree, backed by the same engine running in a hidden WebView
- **formspec-webcomponent** — the existing `<formspec-render>` custom element for any web framework
- **formspec-swift** — SwiftUI views for iOS/macOS

Same FEL expressions. Same validation shapes. Same conditional visibility. Same budget arithmetic — `$0.10 + $0.20 = $0.30` on every platform, because the [Rust kernel's base-10 decimal](/blog/rust-shared-kernel#the-precision-upgrade) runs on all of them.

## formspec-react: React hooks and a composable auto-renderer

React is the most common frontend framework in government digital services. The web component works in React, but React developers expect hooks, context providers, and component composition — not imperative DOM manipulation through a custom element.

**formspec-react** gives React developers a native integration at two levels:

### Level 1: hooks only (full control)

Import from `formspec-react/hooks` and build your own UI. The `FormspecProvider` wraps an engine instance; hooks like `useField`, `useFieldValue`, and `useFieldError` give you reactive state for each field.

```tsx
import { FormspecProvider, useField } from 'formspec-react/hooks';

function BudgetField() {
  const field = useField('total_budget');
  return (
    <div>
      <label htmlFor={field.id}>{field.label}</label>
      <input {...field.inputProps} type="number" />
      {field.touched && field.error && (
        <span role="alert">{field.error}</span>
      )}
    </div>
  );
}
```

`useField` returns everything: value, label, hint, visibility, required state, readonly state, touched state, validation errors, choice options, and a pre-built `inputProps` spread with `aria-invalid` and `aria-required` already set. It re-renders when any of those change. For performance-sensitive forms, `useFieldValue` and `useFieldError` subscribe to a single signal each — a 200-field form where only one field changes doesn't re-render the other 199.

### Level 2: drop-in auto-renderer

Don't want to build every component? `<FormspecForm>` walks the layout tree and renders the whole form:

```tsx
import { FormspecForm } from 'formspec-react';

<FormspecForm
  definition={grantReportDefinition}
  onSubmit={(result) => submitToServer(result.response)}
/>
```

That's it. The auto-renderer plans the layout from the definition (or from a Component Document if you have one), renders each field with accessible defaults, handles repeat groups with add/remove controls and screen-reader announcements, wires up conditional visibility, and provides a submit button that validates before calling your handler.

### Bring your own components

The auto-renderer ships semantic HTML defaults with zero design-system opinions. Need Material UI? Shadcn? Your agency's custom design system? Override individual components:

```tsx
<FormspecForm
  definition={grantReportDefinition}
  components={{
    fields: { TextInput: MyShadcnTextInput, Select: MyShadcnSelect },
    layout: { Card: MyAgencyCard },
  }}
/>
```

The renderer fills in defaults for anything you don't override. Replace one component or all of them. The `FieldComponentProps` interface gives your component the full `UseFieldResult` and the `LayoutNode` with its CSS classes and presentation metadata.

### What's tested

63 unit tests covering every hook, the auto-renderer, all default components, repeat groups, conditional rendering, touched tracking, theme token emission, locale hooks, external validation injection, and submit flow. 14 Playwright E2E tests verifying the full rendering pipeline in a browser. The implementation is at v0.4 — four roadmap milestones completed, covering signal reactivity, initial data population, registry extensions, display nodes, accessibility attributes, runtime context, and locale support.

## formspec-kotlin: native Android forms with Jetpack Compose

Android tablets are standard equipment for federal field inspections, tribal grant reporting, and clinical intake workflows. These environments are often offline. A web-based form loaded in a mobile browser doesn't cut it — you need a native app with native controls, native offline storage, and native accessibility.

**formspec-kotlin** brings Formspec to Android with the same architecture that [formspec-swift](/blog/rust-shared-kernel) established for iOS: a hidden WebView runs the formspec-engine and Rust/WASM kernel, communicating with native Compose UI through a typed JSON message protocol.

### Three layers

| Layer | What it does | Key types |
|-------|-------------|-----------|
| **Bridge** | Hidden Android `WebView` runs the engine. JS-to-native via `@JavascriptInterface`, native-to-JS via `evaluateJavascript`. | `WebViewEngine`, `EngineCommand`, `EngineEvent` |
| **State** | Compose-native reactive state. Field values, errors, visibility — all exposed as `State<T>` properties that trigger recomposition. Non-Compose consumers get `StateFlow<T>`. | `FieldState`, `FormState`, `FormspecEngine` |
| **Renderer** | `@Composable` function types with an overridable component map. Same "bring your own components" story as React. | `FormspecForm`, `ComponentMap` |

### Same bridge, same protocol

The iOS and Android packages share the same HTML bundle (`formspec-engine.html`) and the same message protocol (`EngineCommand`/`EngineEvent` JSON shapes). A field value change on iOS sends the same JSON message as on Android. The bridge is thin — ~500 lines per platform — because the [Rust shared kernel](/blog/rust-shared-kernel) handles all the heavy lifting: FEL evaluation, validation, coercion, dependency resolution.

### Android-specific concerns

**Lifecycle.** The `WebViewEngine` should be scoped to a `ViewModel` — not tied to an Activity or Fragment. Configuration changes (rotation, locale switch, dark mode toggle) recreate the Activity but preserve the ViewModel and its WebView. `FormspecEngine` exposes `pause()` and `resume()` for background/foreground transitions.

**Renderer process death.** Under memory pressure, Android can kill the WebView's renderer process. The bridge detects this via `onRenderProcessGone` (API 26+) and attempts one automatic reload. If recovery fails, `FormspecError.bridgeDisconnected` tells the host app to retry or show an error.

**ProGuard/R8.** The `@JavascriptInterface` methods must survive obfuscation. The library ships `consumer-rules.pro` with the necessary keep rules — no manual ProGuard configuration required.

**No internet required.** The WebView loads a local `file:///android_asset/` HTML file. Basic form operation needs no `INTERNET` permission. If the form uses `choicesFrom` with a remote URL, the host app adds network permission separately.

**API 26+ (Android 8.0).** WebView WASM support starts at Chrome 57, which ships with API 26. `onRenderProcessGone` also requires API 26. This covers 97%+ of active Android devices.

## Why separate packages, not cross-platform

Kotlin Multiplatform (KMP) and Compose Multiplatform exist. We evaluated them and chose separate native packages for four reasons:

1. **Rust is the shared layer.** FEL evaluation, validation, coercion — all normative spec logic lives in Rust crates compiled to WASM (and soon native FFI via [UniFFI](https://mozilla.github.io/uniffi-rs/)). Adding a KMP layer on top would be a second cross-platform bridge for no gain.

2. **The platform binding is ~500 lines.** Signal-to-Observable mapping, WebView lifecycle management, thread dispatch. Not enough code to justify a framework for sharing it.

3. **iOS developers expect Swift packages. Android developers expect Gradle/Maven.** Each ecosystem has its own packaging, testing, and IDE conventions. KMP fights those conventions instead of embracing them.

4. **Compose Multiplatform kills the component map story.** The value proposition is "bring your own components" — Material 3, your agency's design system, custom Compose views. CMP forces everyone into the Compose Multiplatform component set. SwiftUI developers can't use their native views.

The architecture is: Rust kernel (shared) → platform bridge (thin, native) → platform UI (fully native, fully overridable). Cross-platform sharing happens at the logic layer, not the UI layer.

## The platform matrix

| Platform | Package | UI framework | Engine bridge | Status |
|----------|---------|-------------|---------------|--------|
| Web (any) | formspec-webcomponent | Custom Elements | Direct (WASM in-process) | Shipping |
| Web (React) | formspec-react | React 18+/19 | Direct (WASM in-process) | v0.4 complete |
| iOS/macOS | formspec-swift | SwiftUI | Hidden WKWebView | Shipping |
| Android | formspec-kotlin | Jetpack Compose 1.5+ | Hidden Android WebView | ADR accepted |
| Server | formspec (Python) | N/A | PyO3 native binding | Shipping |

One JSON definition file. Five runtimes. Zero divergence in validation behavior.

## The honest tradeoffs

**WebView bridge latency on mobile.** The iOS and Android packages run the engine in a hidden WebView, not as a native library. Every field change crosses a JS-native boundary. For typical form interactions — a keystroke, a dropdown selection — the latency is imperceptible. For a form that recalculates 50 dependent fields on every keystroke, you'd notice. The future direction (Rust FFI via UniFFI, bypassing the WebView entirely) eliminates this, but it's not shipped yet.

**formspec-kotlin is ADR-accepted, not shipped.** The architecture decision is finalized; the implementation is in progress. formspec-react is at v0.4 with 77 passing tests. formspec-kotlin will follow the same test-driven development path, with instrumented tests (WebView requires a real Activity) paralleling the macOS E2E tests in formspec-swift.

**Bundle size.** The WASM binary adds to your app size. On web, formspec-react inherits the same WASM bundle as the web component — acceptable for internal tools and grant portals, worth measuring for public-facing consumer apps. On mobile, the HTML+WASM bundle ships in the app's assets. It's a fixed cost, not per-form.

**React 18+ only.** formspec-react uses `useSyncExternalStore` (React 18) for glitch-free signal-to-React bridging. React 17 and earlier are not supported.

**Default components are minimal.** The auto-renderer's built-in components produce semantic HTML with accessibility attributes — not styled components. This is intentional (zero design-system opinions), but it means you either bring your own components or write CSS. There's no "looks good out of the box" mode yet.

## What's next

**formspec-kotlin implementation.** The ADR is accepted; the implementation follows the same three-layer pattern proven in formspec-swift. Instrumented tests, lifecycle verification, and a demo app are on the roadmap.

**UniFFI migration.** Both mobile packages currently use a hidden WebView as the engine bridge. The end state is native Rust FFI via Mozilla's [UniFFI](https://mozilla.github.io/uniffi-rs/), which generates both Swift and Kotlin bindings from the same `.udl` definition. This eliminates the WebView, reduces memory overhead, and removes the JS-native boundary latency. The WebView bridge is the pragmatic first step; native FFI is the long-term architecture.

**USWDS component sets.** The "bring your own components" story works today. Pre-built component sets for [USWDS](https://designsystem.digital.gov/) (React), Material 3 (Compose), and Apple HIG (SwiftUI) are on the roadmap — so a form manager can deploy a USWDS-compliant form on web and a Material 3 form on Android from the same definition, with no component overrides required.

The [Rust shared kernel post](/blog/rust-shared-kernel) ended with: "One codebase. Every platform. Same expression, same result." Two new packages later, that's closer to literal.
