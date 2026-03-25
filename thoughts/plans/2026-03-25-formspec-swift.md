# formspec-swift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Swift Package that renders formspec-defined forms as native SwiftUI views, using a hidden WKWebView to run the existing formspec-engine + WASM.

**Architecture:** A hidden `WKWebView` loads a self-contained HTML bundle (tree-shaken formspec-engine JS + inlined WASM). Swift communicates via typed JSON messages (`EngineCommand` → JS, `EngineEvent` ← JS). State updates flow into `@Observable` objects (`FieldState`, `FormState`) that SwiftUI views bind to directly. An auto-renderer walks a pre-generated `LayoutNode` tree and dispatches to a component map of SwiftUI views.

**Tech Stack:** Swift 5.9+, SwiftUI, iOS 17+ `@Observable`, WKWebView, esbuild (for JS bundling), XCTest

**Spec:** `thoughts/specs/2026-03-25-formspec-swift-design.md`

---

## File Structure

```
packages/formspec-swift/
├── Package.swift
├── bridge/                              # JS-side message dispatcher (compiled into HTML bundle)
│   ├── dispatcher.ts                    # EngineCommand → FormEngine calls, signals → EngineEvent batches
│   ├── esbuild.config.mjs              # Bundles dispatcher + formspec-engine/render → IIFE JS
│   └── template.html                   # HTML shell that loads the inlined JS + WASM
├── scripts/
│   └── build-bridge.sh                 # Runs esbuild, inlines JS into HTML, copies to Resources/
├── Sources/
│   └── FormspecSwift/
│       ├── Types/
│       │   ├── JSONValue.swift          # Codable JSON enum (string|number|bool|null|array|object)
│       │   ├── LayoutNode.swift         # LayoutNode, Presentation, AccessibilityInfo, enums
│       │   ├── RenderingBundle.swift    # RenderingBundle, RuntimeContext
│       │   ├── ValidationTypes.swift    # ValidationReport, ResolvedValidationResult, ValidationSummary
│       │   └── FieldTypes.swift         # ResolvedOption, DisabledDisplay, ValidationMode
│       ├── Bridge/
│       │   ├── EngineCommand.swift      # Command enum (Swift → JS)
│       │   ├── EngineEvent.swift        # Event enum + patch types (JS → Swift)
│       │   └── WebViewEngine.swift      # Hidden WKWebView lifecycle + message handling
│       ├── State/
│       │   ├── FieldState.swift         # @Observable per-field reactive state
│       │   ├── FormState.swift          # @Observable form-level reactive state
│       │   └── FormspecEngine.swift     # @MainActor @Observable engine wrapper
│       ├── Renderer/
│       │   ├── ComponentMap.swift       # ComponentMap, FieldComponent, LayoutComponent protocols
│       │   ├── FormspecForm.swift       # Drop-in auto-renderer (walks LayoutNode tree)
│       │   ├── FormspecField.swift      # Dispatches field nodes to component map
│       │   └── FormspecLayout.swift     # Dispatches layout nodes to component map
│       ├── Components/
│       │   ├── DefaultFieldComponents.swift   # TextInput, NumberInput, Select, etc.
│       │   └── DefaultLayoutComponents.swift  # Stack, Card, Grid, Page
│       ├── Errors/
│       │   └── FormspecError.swift      # Error enum
│       └── Resources/
│           └── formspec-engine.html     # Generated — do not edit. Built by scripts/build-bridge.sh
├── Tests/
│   └── FormspecSwiftTests/
│       ├── Types/
│       │   ├── JSONValueTests.swift
│       │   ├── LayoutNodeTests.swift
│       │   └── RenderingBundleTests.swift
│       ├── Bridge/
│       │   ├── EngineCommandTests.swift
│       │   ├── EngineEventTests.swift
│       │   └── WebViewEngineTests.swift
│       ├── State/
│       │   ├── FieldStateTests.swift
│       │   ├── FormStateTests.swift
│       │   └── FormspecEngineTests.swift
│       ├── Renderer/
│       │   └── ComponentMapTests.swift
│       └── Fixtures/
│           ├── simple-form.definition.json
│           ├── simple-form.layout.json
│           └── simple-form.locale.en.json
└── .gitignore                           # Ignore .build/, .swiftpm/
```

---

### Task 1: Swift Package Scaffolding

**Files:**
- Create: `packages/formspec-swift/Package.swift`
- Create: `packages/formspec-swift/.gitignore`
- Create: `packages/formspec-swift/Sources/FormspecSwift/FormspecSwift.swift` (placeholder barrel)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/formspec-swift/Sources/FormspecSwift/{Types,Bridge,State,Renderer,Components,Errors,Resources}
mkdir -p packages/formspec-swift/Tests/FormspecSwiftTests/{Types,Bridge,State,Renderer,Fixtures}
mkdir -p packages/formspec-swift/bridge
mkdir -p packages/formspec-swift/scripts
```

- [ ] **Step 2: Write Package.swift**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FormspecSwift",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .visionOS(.v1)
    ],
    products: [
        .library(name: "FormspecSwift", targets: ["FormspecSwift"]),
    ],
    targets: [
        .target(
            name: "FormspecSwift",
            resources: [.copy("Resources/formspec-engine.html")]
        ),
        .testTarget(
            name: "FormspecSwiftTests",
            dependencies: ["FormspecSwift"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
```

- [ ] **Step 3: Write .gitignore**

```
.build/
.swiftpm/
Package.resolved
```

- [ ] **Step 4: Write placeholder barrel**

Create `Sources/FormspecSwift/FormspecSwift.swift`:

```swift
/// Formspec Swift — Native SwiftUI form renderer.
/// Uses a hidden WKWebView bridge to the formspec-engine + WASM runtime.
public enum FormspecSwift {
    public static let version = "0.1.0"
}
```

- [ ] **Step 5: Create placeholder HTML resource**

Create `Sources/FormspecSwift/Resources/formspec-engine.html`:

```html
<!DOCTYPE html>
<html><body><script>
// Placeholder — replaced by build-bridge.sh
window.webkit?.messageHandlers?.formspec?.postMessage(
    JSON.stringify([{ type: "engineError", message: "Bridge not built. Run scripts/build-bridge.sh" }])
);
</script></body></html>
```

- [ ] **Step 6: Verify the package compiles**

Run: `cd packages/formspec-swift && swift build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-swift/
git commit -m "feat(swift): scaffold formspec-swift package"
```

---

### Task 2: Core Types — JSONValue

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Types/JSONValue.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Types/JSONValueTests.swift`

`JSONValue` is the foundation — almost every other type depends on it for representing arbitrary JSON.

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import FormspecSwift

final class JSONValueTests: XCTestCase {

    // MARK: - Decoding

    func testDecodeString() throws {
        let json = Data(#""hello""#.utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        XCTAssertEqual(value, .string("hello"))
    }

    func testDecodeNumber() throws {
        let json = Data("42.5".utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        XCTAssertEqual(value, .number(42.5))
    }

    func testDecodeBool() throws {
        let json = Data("true".utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        XCTAssertEqual(value, .bool(true))
    }

    func testDecodeNull() throws {
        let json = Data("null".utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        XCTAssertEqual(value, .null)
    }

    func testDecodeArray() throws {
        let json = Data(#"[1, "two", true]"#.utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        XCTAssertEqual(value, .array([.number(1), .string("two"), .bool(true)]))
    }

    func testDecodeObject() throws {
        let json = Data(#"{"name": "Alice", "age": 30}"#.utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        if case .object(let dict) = value {
            XCTAssertEqual(dict["name"], .string("Alice"))
            XCTAssertEqual(dict["age"], .number(30))
        } else {
            XCTFail("Expected object")
        }
    }

    func testDecodeNestedStructure() throws {
        let json = Data(#"{"items": [{"key": "a"}, {"key": "b"}]}"#.utf8)
        let value = try JSONDecoder().decode(JSONValue.self, from: json)
        if case .object(let dict) = value,
           case .array(let items) = dict["items"] {
            XCTAssertEqual(items.count, 2)
        } else {
            XCTFail("Expected nested object with array")
        }
    }

    // MARK: - Encoding round-trip

    func testEncodingRoundTrip() throws {
        let original: JSONValue = .object([
            "name": .string("test"),
            "count": .number(5),
            "active": .bool(true),
            "tags": .array([.string("a"), .string("b")]),
            "meta": .null
        ])
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(JSONValue.self, from: data)
        XCTAssertEqual(original, decoded)
    }

    // MARK: - Convenience accessors

    func testStringValue() {
        XCTAssertEqual(JSONValue.string("hello").stringValue, "hello")
        XCTAssertNil(JSONValue.number(42).stringValue)
    }

    func testNumberValue() {
        XCTAssertEqual(JSONValue.number(42.5).numberValue, 42.5)
        XCTAssertNil(JSONValue.string("42").numberValue)
    }

    func testBoolValue() {
        XCTAssertEqual(JSONValue.bool(true).boolValue, true)
        XCTAssertNil(JSONValue.string("true").boolValue)
    }

    func testArrayValue() {
        let arr: [JSONValue] = [.number(1), .number(2)]
        XCTAssertEqual(JSONValue.array(arr).arrayValue, arr)
        XCTAssertNil(JSONValue.string("[]").arrayValue)
    }

    func testObjectValue() {
        let dict: [String: JSONValue] = ["key": .string("val")]
        XCTAssertEqual(JSONValue.object(dict).objectValue, dict)
        XCTAssertNil(JSONValue.string("{}").objectValue)
    }

    func testIsNull() {
        XCTAssertTrue(JSONValue.null.isNull)
        XCTAssertFalse(JSONValue.string("").isNull)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter JSONValueTests 2>&1 | tail -10`
Expected: Compilation error — `JSONValue` not defined

- [ ] **Step 3: Implement JSONValue**

```swift
/// A type-safe representation of arbitrary JSON values.
/// Used throughout FormspecSwift to represent untyped JSON data from definitions,
/// layout plans, and engine bridge messages.
public enum JSONValue: Codable, Equatable, Hashable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    // MARK: - Codable

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else {
            throw DecodingError.typeMismatch(
                JSONValue.self,
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unsupported JSON value")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let s): try container.encode(s)
        case .number(let n): try container.encode(n)
        case .bool(let b): try container.encode(b)
        case .null: try container.encodeNil()
        case .array(let a): try container.encode(a)
        case .object(let o): try container.encode(o)
        }
    }

    // MARK: - Convenience accessors

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var numberValue: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let o) = self { return o }
        return nil
    }

    public var isNull: Bool {
        if case .null = self { return true }
        return false
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter JSONValueTests 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Types/JSONValue.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/Types/JSONValueTests.swift
git commit -m "feat(swift): add JSONValue Codable enum"
```

---

### Task 3: Core Types — LayoutNode, Errors, Field Types

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Types/LayoutNode.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Types/FieldTypes.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Types/ValidationTypes.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Errors/FormspecError.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Types/LayoutNodeTests.swift`

- [ ] **Step 1: Write LayoutNode test with fixture JSON**

Create test fixture at `Tests/FormspecSwiftTests/Fixtures/simple-layout.json`:

```json
{
    "id": "root",
    "component": "Stack",
    "category": "layout",
    "props": { "direction": "vertical" },
    "cssClasses": ["form-root"],
    "children": [
        {
            "id": "field-name",
            "component": "TextInput",
            "category": "field",
            "props": {},
            "cssClasses": [],
            "children": [],
            "bindPath": "contactInfo.fullName",
            "fieldItem": {
                "key": "fullName",
                "label": "Full Name",
                "hint": "Enter your full legal name",
                "dataType": "string"
            },
            "presentation": {
                "widget": "text",
                "labelPosition": "top"
            },
            "labelPosition": "top"
        },
        {
            "id": "field-email",
            "component": "TextInput",
            "category": "field",
            "props": {},
            "cssClasses": [],
            "children": [],
            "bindPath": "contactInfo.email",
            "when": "$relevant"
        }
    ]
}
```

```swift
import XCTest
@testable import FormspecSwift

final class LayoutNodeTests: XCTestCase {

    func testDecodeLayoutTree() throws {
        let url = Bundle.module.url(forResource: "simple-layout", withExtension: "json", subdirectory: "Fixtures")!
        let data = try Data(contentsOf: url)
        let root = try JSONDecoder().decode(LayoutNode.self, from: data)

        XCTAssertEqual(root.id, "root")
        XCTAssertEqual(root.component, "Stack")
        XCTAssertEqual(root.category, .layout)
        XCTAssertEqual(root.children.count, 2)

        let nameField = root.children[0]
        XCTAssertEqual(nameField.component, "TextInput")
        XCTAssertEqual(nameField.category, .field)
        XCTAssertEqual(nameField.bindPath, "contactInfo.fullName")
        XCTAssertEqual(nameField.fieldItem?.label, "Full Name")
        XCTAssertEqual(nameField.fieldItem?.hint, "Enter your full legal name")
        XCTAssertEqual(nameField.presentation?.widget, "text")
        XCTAssertEqual(nameField.labelPosition, .top)

        let emailField = root.children[1]
        XCTAssertEqual(emailField.when, "$relevant")
        XCTAssertNil(emailField.presentation)
    }

    func testDecodeAccessibilityInfo() throws {
        let json = Data(#"{"role": "form", "description": "Contact form"}"#.utf8)
        let info = try JSONDecoder().decode(AccessibilityInfo.self, from: json)
        XCTAssertEqual(info.role, "form")
        XCTAssertEqual(info.description, "Contact form")
        XCTAssertNil(info.liveRegion)
    }

    func testNodeCategoryRawValues() {
        XCTAssertEqual(NodeCategory.layout.rawValue, "layout")
        XCTAssertEqual(NodeCategory.field.rawValue, "field")
        XCTAssertEqual(NodeCategory.display.rawValue, "display")
        XCTAssertEqual(NodeCategory.interactive.rawValue, "interactive")
        XCTAssertEqual(NodeCategory.special.rawValue, "special")
    }

    func testLabelPositionRawValues() {
        XCTAssertEqual(LabelPosition.top.rawValue, "top")
        XCTAssertEqual(LabelPosition.start.rawValue, "start")
        XCTAssertEqual(LabelPosition.hidden.rawValue, "hidden")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/formspec-swift && swift test --filter LayoutNodeTests 2>&1 | tail -10`
Expected: Compilation error — `LayoutNode` not defined

- [ ] **Step 3: Implement LayoutNode and supporting types**

`Sources/FormspecSwift/Types/LayoutNode.swift`:

```swift
/// A node in the pre-generated layout tree. Decoded from the layoutPlan JSON.
/// The auto-renderer walks this tree to produce SwiftUI views.
public struct LayoutNode: Codable, Sendable {
    public let id: String
    public let component: String
    public let category: NodeCategory
    public let props: [String: JSONValue]
    public let style: [String: JSONValue]?
    public let cssClasses: [String]
    public let accessibility: AccessibilityInfo?
    public let children: [LayoutNode]

    // Field binding
    public let bindPath: String?
    public let fieldItem: FieldItemInfo?
    public let presentation: Presentation?
    public let labelPosition: LabelPosition?

    // Conditional rendering
    public let when: String?
    public let whenPrefix: String?
    public let fallback: String?

    // Repeat groups
    public let repeatGroup: String?
    public let repeatPath: String?
    public let isRepeatTemplate: Bool?
}

public struct FieldItemInfo: Codable, Sendable {
    public let key: String
    public let label: String
    public let hint: String?
    public let dataType: String?
}

public struct Presentation: Codable, Sendable {
    public let widget: String?
    public let widgetConfig: [String: JSONValue]?
    public let labelPosition: LabelPosition?
    public let style: [String: JSONValue]?
    public let accessibility: AccessibilityInfo?
    public let cssClass: String?
}

public struct AccessibilityInfo: Codable, Sendable {
    public let role: String?
    public let description: String?
    public let liveRegion: String?
}

public enum NodeCategory: String, Codable, Sendable {
    case layout, field, display, interactive, special
}

public enum LabelPosition: String, Codable, Sendable {
    case top, start, hidden
}
```

- [ ] **Step 4: Implement FieldTypes and ValidationTypes**

`Sources/FormspecSwift/Types/FieldTypes.swift`:

```swift
public struct ResolvedOption: Codable, Equatable, Sendable {
    public let value: JSONValue
    public let label: String
}

public enum DisabledDisplay: String, Codable, Sendable {
    case hidden, protected
}

public enum ValidationMode: Sendable {
    case continuous
    case submit
}
```

`Sources/FormspecSwift/Types/ValidationTypes.swift`:

```swift
public struct ValidationReport: Codable, Sendable {
    public let results: [ResolvedValidationResult]
    public let isValid: Bool
}

public struct ResolvedValidationResult: Codable, Equatable, Sendable {
    public let path: String?
    public let message: String
    public let severity: ValidationSeverity
    public let constraintKind: String?
    public let code: String?
}

public enum ValidationSeverity: String, Codable, Sendable {
    case error, warning, info
}

public struct ValidationSummary: Equatable, Sendable {
    public let errors: Int
    public let warnings: Int
    public let infos: Int
}
```

- [ ] **Step 5: Implement FormspecError**

`Sources/FormspecSwift/Errors/FormspecError.swift`:

```swift
public enum FormspecError: Error, Sendable {
    case wasmLoadFailed(underlying: String)
    case engineLoadFailed(message: String)
    case definitionInvalid(message: String)
    case bridgeDisconnected
    case bridgeTimeout
    case localeNotAvailable(languageCode: String)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter LayoutNodeTests 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Types/
git add packages/formspec-swift/Sources/FormspecSwift/Errors/
git add packages/formspec-swift/Tests/FormspecSwiftTests/Types/LayoutNodeTests.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/Fixtures/simple-layout.json
git commit -m "feat(swift): add LayoutNode, FieldTypes, ValidationTypes, FormspecError"
```

---

### Task 4: Core Types — RenderingBundle

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Types/RenderingBundle.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Types/RenderingBundleTests.swift`

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import FormspecSwift

final class RenderingBundleTests: XCTestCase {

    func testDecodeMinimalBundle() throws {
        let json = Data(#"""
        {
            "definition": {"formId": "test", "items": []},
            "layoutPlan": {"id": "root", "component": "Stack", "category": "layout", "props": {}, "cssClasses": [], "children": []}
        }
        """#.utf8)
        let bundle = try JSONDecoder().decode(RenderingBundle.self, from: json)
        XCTAssertNotNil(bundle.definition.objectValue)
        XCTAssertNil(bundle.component)
        XCTAssertNil(bundle.theme)
        XCTAssertNil(bundle.registry)
        XCTAssertNil(bundle.locales)
        XCTAssertNil(bundle.defaultLocale)
        XCTAssertNil(bundle.runtimeContext)
    }

    func testDecodeFullBundle() throws {
        let json = Data(#"""
        {
            "definition": {"formId": "test", "items": []},
            "layoutPlan": {"id": "root", "component": "Stack", "category": "layout", "props": {}, "cssClasses": [], "children": []},
            "component": {"version": "1.0"},
            "theme": {"tokens": {}},
            "registry": [{"id": "ext1"}],
            "locales": {
                "en": {"strings": {}},
                "es": {"strings": {}}
            },
            "defaultLocale": "en",
            "runtimeContext": {
                "meta": {"userId": "u123"},
                "timeZone": "America/New_York",
                "seed": 42
            }
        }
        """#.utf8)
        let bundle = try JSONDecoder().decode(RenderingBundle.self, from: json)
        XCTAssertNotNil(bundle.component)
        XCTAssertNotNil(bundle.theme)
        XCTAssertEqual(bundle.registry?.count, 1)
        XCTAssertEqual(bundle.locales?.count, 2)
        XCTAssertEqual(bundle.defaultLocale, "en")
        XCTAssertEqual(bundle.runtimeContext?.timeZone, "America/New_York")
        XCTAssertEqual(bundle.runtimeContext?.seed, 42)
        XCTAssertEqual(bundle.runtimeContext?.meta?["userId"], .string("u123"))
    }

    func testEncodingRoundTrip() throws {
        let bundle = RenderingBundle(
            definition: .object(["formId": .string("test"), "items": .array([])]),
            layoutPlan: .object(["id": .string("root"), "component": .string("Stack"), "category": .string("layout"), "props": .object([:]), "cssClasses": .array([]), "children": .array([])]),
            component: nil,
            theme: nil,
            registry: nil,
            locales: ["en": .object(["strings": .object([:])]) ],
            defaultLocale: "en",
            runtimeContext: RuntimeContext(meta: ["key": .string("val")], timeZone: "UTC", seed: nil)
        )
        let data = try JSONEncoder().encode(bundle)
        let decoded = try JSONDecoder().decode(RenderingBundle.self, from: data)
        XCTAssertEqual(decoded.defaultLocale, "en")
        XCTAssertEqual(decoded.runtimeContext?.timeZone, "UTC")
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter RenderingBundleTests 2>&1 | tail -10`
Expected: Compilation error — `RenderingBundle` not defined

- [ ] **Step 3: Implement RenderingBundle**

```swift
/// Everything the engine needs to render a form.
/// Developers load these from bundled assets, API responses, or local cache.
public struct RenderingBundle: Codable, Sendable {
    public let definition: JSONValue
    public let layoutPlan: JSONValue
    public let component: JSONValue?
    public let theme: JSONValue?
    public let registry: [JSONValue]?
    public let locales: [String: JSONValue]?
    public let defaultLocale: String?
    public let runtimeContext: RuntimeContext?

    public init(
        definition: JSONValue,
        layoutPlan: JSONValue,
        component: JSONValue? = nil,
        theme: JSONValue? = nil,
        registry: [JSONValue]? = nil,
        locales: [String: JSONValue]? = nil,
        defaultLocale: String? = nil,
        runtimeContext: RuntimeContext? = nil
    ) {
        self.definition = definition
        self.layoutPlan = layoutPlan
        self.component = component
        self.theme = theme
        self.registry = registry
        self.locales = locales
        self.defaultLocale = defaultLocale
        self.runtimeContext = runtimeContext
    }
}

public struct RuntimeContext: Codable, Sendable {
    public let meta: [String: JSONValue]?
    public let timeZone: String?
    public let seed: Int?

    public init(meta: [String: JSONValue]? = nil, timeZone: String? = nil, seed: Int? = nil) {
        self.meta = meta
        self.timeZone = timeZone
        self.seed = seed
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter RenderingBundleTests 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Types/RenderingBundle.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/Types/RenderingBundleTests.swift
git commit -m "feat(swift): add RenderingBundle and RuntimeContext types"
```

---

### Task 5: Message Protocol — EngineCommand & EngineEvent

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Bridge/EngineCommand.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Bridge/EngineEvent.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Bridge/EngineCommandTests.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Bridge/EngineEventTests.swift`

These enums define the typed message protocol between Swift and the JS engine. They must serialize to JSON that the JS dispatcher can parse.

- [ ] **Step 1: Write EngineCommand tests**

```swift
import XCTest
@testable import FormspecSwift

final class EngineCommandTests: XCTestCase {

    func testEncodeSetValue() throws {
        let cmd = EngineCommand.setValue(path: "name", value: .string("Alice"))
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("setValue"))
        XCTAssertEqual(json["path"], .string("name"))
        XCTAssertEqual(json["value"], .string("Alice"))
    }

    func testEncodeSetValueNull() throws {
        let cmd = EngineCommand.setValue(path: "name", value: nil)
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("setValue"))
        XCTAssertEqual(json["value"], .null)
    }

    func testEncodeSetLocale() throws {
        let cmd = EngineCommand.setLocale(languageCode: "es")
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("setLocale"))
        XCTAssertEqual(json["languageCode"], .string("es"))
    }

    func testEncodeAddRepeatInstance() throws {
        let cmd = EngineCommand.addRepeatInstance(groupName: "members")
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("addRepeatInstance"))
        XCTAssertEqual(json["groupName"], .string("members"))
    }

    func testEncodeGetResponse() throws {
        let cmd = EngineCommand.getResponse
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("getResponse"))
    }

    func testEncodeGetValidationReport() throws {
        let cmd = EngineCommand.getValidationReport(mode: "submit")
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("getValidationReport"))
        XCTAssertEqual(json["mode"], .string("submit"))
    }

    func testEncodeTouchField() throws {
        let cmd = EngineCommand.touchField(path: "email")
        let data = try JSONEncoder().encode(cmd)
        let json = try JSONDecoder().decode([String: JSONValue].self, from: data)
        XCTAssertEqual(json["type"], .string("touchField"))
        XCTAssertEqual(json["path"], .string("email"))
    }
}
```

- [ ] **Step 2: Write EngineEvent tests**

```swift
import XCTest
@testable import FormspecSwift

final class EngineEventTests: XCTestCase {

    func testDecodeEngineReady() throws {
        let json = Data(#"{"type": "engineReady"}"#.utf8)
        let event = try JSONDecoder().decode(EngineEvent.self, from: json)
        if case .engineReady = event {} else { XCTFail("Expected engineReady") }
    }

    func testDecodeEngineError() throws {
        let json = Data(#"{"type": "engineError", "message": "WASM failed"}"#.utf8)
        let event = try JSONDecoder().decode(EngineEvent.self, from: json)
        if case .engineError(let msg) = event {
            XCTAssertEqual(msg, "WASM failed")
        } else { XCTFail("Expected engineError") }
    }

    func testDecodeFieldStateChanged() throws {
        let json = Data(#"""
        {
            "type": "fieldStateChanged",
            "path": "contactInfo.name",
            "changes": {
                "label": "Full Name",
                "value": "Alice",
                "required": true,
                "visible": true,
                "readonly": false,
                "touched": false,
                "errors": [],
                "firstError": null
            }
        }
        """#.utf8)
        let event = try JSONDecoder().decode(EngineEvent.self, from: json)
        if case .fieldStateChanged(let path, let changes) = event {
            XCTAssertEqual(path, "contactInfo.name")
            XCTAssertEqual(changes.label, "Full Name")
            XCTAssertEqual(changes.value, .string("Alice"))
            XCTAssertEqual(changes.required, true)
        } else { XCTFail("Expected fieldStateChanged") }
    }

    func testDecodeFormStateChanged() throws {
        let json = Data(#"""
        {
            "type": "formStateChanged",
            "changes": {
                "title": "My Form",
                "description": "A test form",
                "isValid": false,
                "errors": 2,
                "warnings": 1,
                "infos": 0
            }
        }
        """#.utf8)
        let event = try JSONDecoder().decode(EngineEvent.self, from: json)
        if case .formStateChanged(let changes) = event {
            XCTAssertEqual(changes.title, "My Form")
            XCTAssertEqual(changes.isValid, false)
            XCTAssertEqual(changes.errors, 2)
        } else { XCTFail("Expected formStateChanged") }
    }

    func testDecodeRepeatChanged() throws {
        let json = Data(#"{"type": "repeatChanged", "groupName": "members", "count": 3}"#.utf8)
        let event = try JSONDecoder().decode(EngineEvent.self, from: json)
        if case .repeatChanged(let group, let count) = event {
            XCTAssertEqual(group, "members")
            XCTAssertEqual(count, 3)
        } else { XCTFail("Expected repeatChanged") }
    }

    func testDecodeBatchOfEvents() throws {
        let json = Data(#"""
        [
            {"type": "fieldStateChanged", "path": "name", "changes": {"label": "Name", "value": null, "required": true, "visible": true, "readonly": false, "touched": false, "errors": [], "firstError": null}},
            {"type": "formStateChanged", "changes": {"title": "Form", "isValid": true, "errors": 0, "warnings": 0, "infos": 0}},
            {"type": "engineReady"}
        ]
        """#.utf8)
        let events = try JSONDecoder().decode([EngineEvent].self, from: json)
        XCTAssertEqual(events.count, 3)
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter "EngineCommandTests|EngineEventTests" 2>&1 | tail -10`
Expected: Compilation error

- [ ] **Step 4: Implement EngineCommand**

The command serializes as a flat JSON object with a `type` discriminator, NOT as a Swift enum with associated values' default encoding. This is critical — the JS dispatcher expects `{ "type": "setValue", "path": "...", "value": ... }`.

```swift
/// Commands sent from Swift to the JS engine inside the WebView.
/// Serialized as flat JSON objects with a "type" discriminator.
enum EngineCommand: Sendable {
    case initialize(RenderingBundle)
    case setValue(path: String, value: JSONValue?)
    case setLocale(languageCode: String)
    case setResponse(JSONValue)
    case touchField(path: String)
    case addRepeatInstance(groupName: String)
    case removeRepeatInstance(groupName: String, index: Int)
    case getResponse
    case getValidationReport(mode: String)
}

extension EngineCommand: Encodable {
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKey.self)
        switch self {
        case .initialize(let bundle):
            try container.encode("initialize", forKey: .key("type"))
            try container.encode(bundle, forKey: .key("bundle"))
        case .setValue(let path, let value):
            try container.encode("setValue", forKey: .key("type"))
            try container.encode(path, forKey: .key("path"))
            try container.encode(value ?? .null, forKey: .key("value"))
        case .setLocale(let code):
            try container.encode("setLocale", forKey: .key("type"))
            try container.encode(code, forKey: .key("languageCode"))
        case .setResponse(let data):
            try container.encode("setResponse", forKey: .key("type"))
            try container.encode(data, forKey: .key("data"))
        case .touchField(let path):
            try container.encode("touchField", forKey: .key("type"))
            try container.encode(path, forKey: .key("path"))
        case .addRepeatInstance(let group):
            try container.encode("addRepeatInstance", forKey: .key("type"))
            try container.encode(group, forKey: .key("groupName"))
        case .removeRepeatInstance(let group, let index):
            try container.encode("removeRepeatInstance", forKey: .key("type"))
            try container.encode(group, forKey: .key("groupName"))
            try container.encode(index, forKey: .key("index"))
        case .getResponse:
            try container.encode("getResponse", forKey: .key("type"))
        case .getValidationReport(let mode):
            try container.encode("getValidationReport", forKey: .key("type"))
            try container.encode(mode, forKey: .key("mode"))
        }
    }
}

/// Dynamic coding key for flat JSON serialization.
struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
    static func key(_ name: String) -> DynamicCodingKey { DynamicCodingKey(stringValue: name)! }
}
```

- [ ] **Step 5: Implement EngineEvent**

```swift
/// Events received from the JS engine inside the WebView.
/// Decoded from JSON with a "type" discriminator.
enum EngineEvent: Sendable {
    case fieldStateChanged(path: String, changes: FieldStatePatch)
    case formStateChanged(changes: FormStatePatch)
    case pageStateChanged(pageId: String, title: String, description: String)
    case repeatChanged(groupName: String, count: Int)
    case responseResult(JSONValue)
    case validationReportResult(ValidationReport)
    case engineReady
    case engineError(message: String)
}

/// Partial update to a field's observable state.
/// Note: `touched` is NOT in this patch — it is managed purely on the Swift side.
/// The engine bridge does not track interaction state.
struct FieldStatePatch: Codable, Sendable {
    let label: String?
    let hint: String?
    let description: String?
    let value: JSONValue?
    let required: Bool?
    let visible: Bool?
    let readonly: Bool?
    let errors: [ResolvedValidationResult]?
    let firstError: String?
    let options: [ResolvedOption]?
    let optionsLoading: Bool?
    let optionsError: String?
}

/// Partial update to the form's observable state.
struct FormStatePatch: Codable, Sendable {
    let title: String?
    let description: String?
    let isValid: Bool?
    let errors: Int?
    let warnings: Int?
    let infos: Int?
}

extension EngineEvent: Decodable {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        let type = try container.decode(String.self, forKey: .key("type"))
        switch type {
        case "engineReady":
            self = .engineReady
        case "engineError":
            let msg = try container.decode(String.self, forKey: .key("message"))
            self = .engineError(message: msg)
        case "fieldStateChanged":
            let path = try container.decode(String.self, forKey: .key("path"))
            let changes = try container.decode(FieldStatePatch.self, forKey: .key("changes"))
            self = .fieldStateChanged(path: path, changes: changes)
        case "formStateChanged":
            let changes = try container.decode(FormStatePatch.self, forKey: .key("changes"))
            self = .formStateChanged(changes: changes)
        case "pageStateChanged":
            let pageId = try container.decode(String.self, forKey: .key("pageId"))
            let title = try container.decode(String.self, forKey: .key("title"))
            let desc = try container.decodeIfPresent(String.self, forKey: .key("description")) ?? ""
            self = .pageStateChanged(pageId: pageId, title: title, description: desc)
        case "repeatChanged":
            let group = try container.decode(String.self, forKey: .key("groupName"))
            let count = try container.decode(Int.self, forKey: .key("count"))
            self = .repeatChanged(groupName: group, count: count)
        case "responseResult":
            let data = try container.decode(JSONValue.self, forKey: .key("data"))
            self = .responseResult(data)
        case "validationReportResult":
            let report = try container.decode(ValidationReport.self, forKey: .key("report"))
            self = .validationReportResult(report)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .key("type"), in: container,
                debugDescription: "Unknown event type: \(type)"
            )
        }
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter "EngineCommandTests|EngineEventTests" 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Bridge/EngineCommand.swift
git add packages/formspec-swift/Sources/FormspecSwift/Bridge/EngineEvent.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/Bridge/
git commit -m "feat(swift): add EngineCommand and EngineEvent message protocol"
```

---

### Task 6: Observable State — FieldState & FormState

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/State/FieldState.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/State/FormState.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/State/FieldStateTests.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/State/FormStateTests.swift`

These are the `@Observable` classes that SwiftUI views bind to. They receive updates via `apply(patch:)` from the bridge layer.

- [ ] **Step 1: Write FieldState tests**

```swift
import XCTest
@testable import FormspecSwift

final class FieldStateTests: XCTestCase {

    func testInitialState() {
        let state = FieldState(
            templatePath: "name",
            instancePath: "name",
            id: "field-name",
            itemKey: "name",
            dataType: "string",
            disabledDisplay: .hidden,
            engine: nil
        )
        XCTAssertEqual(state.templatePath, "name")
        XCTAssertEqual(state.label, "")
        XCTAssertNil(state.value)
        XCTAssertFalse(state.required)
        XCTAssertTrue(state.visible)
        XCTAssertFalse(state.readonly)
        XCTAssertFalse(state.touched)
        XCTAssertTrue(state.errors.isEmpty)
        XCTAssertNil(state.firstError)
        XCTAssertTrue(state.options.isEmpty)
    }

    func testApplyPatch() {
        let state = FieldState(
            templatePath: "name", instancePath: "name",
            id: "field-name", itemKey: "name", dataType: "string",
            disabledDisplay: .hidden, engine: nil
        )
        let patch = FieldStatePatch(
            label: "Full Name",
            hint: "Enter name",
            description: nil,
            value: .string("Alice"),
            required: true,
            visible: true,
            readonly: false,
            errors: [],
            firstError: nil,
            options: nil,
            optionsLoading: nil,
            optionsError: nil
        )
        state.apply(patch: patch)

        XCTAssertEqual(state.label, "Full Name")
        XCTAssertEqual(state.hint, "Enter name")
        XCTAssertEqual(state.value as? String, "Alice")
        XCTAssertTrue(state.required)
    }

    func testApplyPartialPatch() {
        let state = FieldState(
            templatePath: "name", instancePath: "name",
            id: "field-name", itemKey: "name", dataType: "string",
            disabledDisplay: .hidden, engine: nil
        )
        // First, set some state
        state.apply(patch: FieldStatePatch(
            label: "Name", hint: nil, description: nil, value: .string("Alice"),
            required: true, visible: true, readonly: false,
            errors: [], firstError: nil, options: nil, optionsLoading: nil, optionsError: nil
        ))

        // Then a partial update — only value changed
        state.apply(patch: FieldStatePatch(
            label: nil, hint: nil, description: nil, value: .string("Bob"),
            required: nil, visible: nil, readonly: nil,
            errors: nil, firstError: nil, options: nil, optionsLoading: nil, optionsError: nil
        ))

        XCTAssertEqual(state.label, "Name") // unchanged
        XCTAssertEqual(state.value as? String, "Bob") // updated
        XCTAssertTrue(state.required) // unchanged
    }

    func testTouch() {
        let state = FieldState(
            templatePath: "name", instancePath: "name",
            id: "field-name", itemKey: "name", dataType: "string",
            disabledDisplay: .hidden, engine: nil
        )
        XCTAssertFalse(state.touched)
        state.touch()
        XCTAssertTrue(state.touched)
    }

    func testValueConversion() {
        let state = FieldState(
            templatePath: "age", instancePath: "age",
            id: "field-age", itemKey: "age", dataType: "number",
            disabledDisplay: .hidden, engine: nil
        )
        state.apply(patch: FieldStatePatch(
            label: nil, hint: nil, description: nil, value: .number(25),
            required: nil, visible: nil, readonly: nil,
            errors: nil, firstError: nil, options: nil, optionsLoading: nil, optionsError: nil
        ))
        XCTAssertEqual(state.value as? Double, 25.0)
    }
}
```

- [ ] **Step 2: Write FormState tests**

```swift
import XCTest
@testable import FormspecSwift

final class FormStateTests: XCTestCase {

    func testInitialState() {
        let state = FormState()
        XCTAssertEqual(state.title, "")
        XCTAssertEqual(state.description, "")
        XCTAssertTrue(state.isValid)
        XCTAssertEqual(state.validationSummary.errors, 0)
    }

    func testApplyPatch() {
        let state = FormState()
        let patch = FormStatePatch(
            title: "Contact Form",
            description: "Please fill in your details",
            isValid: false,
            errors: 2,
            warnings: 1,
            infos: 0
        )
        state.apply(patch: patch)

        XCTAssertEqual(state.title, "Contact Form")
        XCTAssertEqual(state.description, "Please fill in your details")
        XCTAssertFalse(state.isValid)
        XCTAssertEqual(state.validationSummary.errors, 2)
        XCTAssertEqual(state.validationSummary.warnings, 1)
    }

    func testApplyPartialPatch() {
        let state = FormState()
        state.apply(patch: FormStatePatch(
            title: "Form", description: "Desc", isValid: true,
            errors: 0, warnings: 0, infos: 0
        ))
        // Now only isValid changes
        state.apply(patch: FormStatePatch(
            title: nil, description: nil, isValid: false,
            errors: 1, warnings: nil, infos: nil
        ))
        XCTAssertEqual(state.title, "Form") // unchanged
        XCTAssertFalse(state.isValid) // updated
        XCTAssertEqual(state.validationSummary.errors, 1) // updated
        XCTAssertEqual(state.validationSummary.warnings, 0) // unchanged
    }

    func testPageTitleCaching() {
        let state = FormState()
        state.setPageTitle("page1", title: "Introduction")
        state.setPageTitle("page2", title: "Details")
        XCTAssertEqual(state.pageTitle("page1"), "Introduction")
        XCTAssertEqual(state.pageTitle("page2"), "Details")
        XCTAssertEqual(state.pageTitle("unknown"), "") // default empty
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter "FieldStateTests|FormStateTests" 2>&1 | tail -10`
Expected: Compilation error

- [ ] **Step 4: Implement FieldState**

```swift
import Foundation

/// Per-field reactive state. SwiftUI views that read properties re-render automatically.
/// Created and managed by FormspecEngine — not constructed directly by consumers.
@Observable
public final class FieldState: @unchecked Sendable {
    // Identity (stable)
    public let templatePath: String
    public let instancePath: String
    public let id: String
    public let itemKey: String
    public let dataType: String
    public let disabledDisplay: DisabledDisplay

    // Presentation (reactive)
    public private(set) var label: String = ""
    public private(set) var hint: String?
    public private(set) var description: String?

    // State (reactive)
    public private(set) var value: Any?
    public private(set) var required: Bool = false
    public private(set) var visible: Bool = true
    public private(set) var readonly: Bool = false

    // Interaction
    public private(set) var touched: Bool = false

    // Validation (reactive)
    public private(set) var errors: [ResolvedValidationResult] = []
    public private(set) var firstError: String?

    // Options (reactive)
    public private(set) var options: [ResolvedOption] = []
    public private(set) var optionsLoading: Bool = false
    public private(set) var optionsError: String?

    // Back-reference to engine for setValue delegation
    weak var engine: FormspecEngine?

    init(
        templatePath: String, instancePath: String,
        id: String, itemKey: String, dataType: String,
        disabledDisplay: DisabledDisplay, engine: FormspecEngine?
    ) {
        self.templatePath = templatePath
        self.instancePath = instancePath
        self.id = id
        self.itemKey = itemKey
        self.dataType = dataType
        self.disabledDisplay = disabledDisplay
        self.engine = engine
    }

    /// Set field value. Delegates to the engine which sends to the JS bridge.
    public func setValue(_ value: Any?) {
        engine?.setValue(instancePath, value: value)
    }

    /// Mark field as touched (user has interacted).
    public func touch() {
        touched = true
        engine?.touchField(instancePath)
    }

    /// Apply a state patch from the JS bridge. Internal only.
    func apply(patch: FieldStatePatch) {
        if let v = patch.label { label = v }
        if let v = patch.hint { hint = v }
        if let v = patch.description { description = v }
        if let v = patch.value { value = v.toAny() }
        if let v = patch.required { required = v }
        if let v = patch.visible { visible = v }
        if let v = patch.readonly { readonly = v }
        // Note: touched is NOT set from patches — it is Swift-side only
        if let v = patch.errors { errors = v }
        // firstError: explicit nil is valid (clears error)
        if patch.firstError != nil || patch.errors != nil {
            firstError = patch.firstError
        }
        if let v = patch.options { options = v }
        if let v = patch.optionsLoading { optionsLoading = v }
        if let v = patch.optionsError { optionsError = v }
    }
}

extension JSONValue {
    /// Convert JSONValue to Any? for FieldState.value
    func toAny() -> Any? {
        switch self {
        case .string(let s): return s
        case .number(let n): return n
        case .bool(let b): return b
        case .null: return nil
        case .array(let a): return a.map { $0.toAny() }
        case .object(let o): return o.mapValues { $0.toAny() }
        }
    }
}
```

- [ ] **Step 5: Implement FormState**

```swift
import Foundation

/// Form-level reactive state.
@Observable
public final class FormState: @unchecked Sendable {
    public private(set) var title: String = ""
    public private(set) var description: String = ""
    public private(set) var isValid: Bool = true
    public private(set) var validationSummary: ValidationSummary = ValidationSummary(errors: 0, warnings: 0, infos: 0)

    // Cached page titles/descriptions (reactive via @Observable)
    private var pageTitles: [String: String] = [:]
    private var pageDescriptions: [String: String] = [:]

    public init() {}

    public func pageTitle(_ pageId: String) -> String {
        pageTitles[pageId] ?? ""
    }

    public func pageDescription(_ pageId: String) -> String {
        pageDescriptions[pageId] ?? ""
    }

    /// Internal: set page title from bridge event
    func setPageTitle(_ pageId: String, title: String) {
        pageTitles[pageId] = title
    }

    /// Internal: set page description from bridge event
    func setPageDescription(_ pageId: String, description: String) {
        pageDescriptions[pageId] = description
    }

    /// Apply a state patch from the JS bridge. Internal only.
    func apply(patch: FormStatePatch) {
        if let v = patch.title { title = v }
        if let v = patch.description { description = v }
        if let v = patch.isValid { isValid = v }
        let e = patch.errors ?? validationSummary.errors
        let w = patch.warnings ?? validationSummary.warnings
        let i = patch.infos ?? validationSummary.infos
        if patch.errors != nil || patch.warnings != nil || patch.infos != nil {
            validationSummary = ValidationSummary(errors: e, warnings: w, infos: i)
        }
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter "FieldStateTests|FormStateTests" 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/State/
git add packages/formspec-swift/Tests/FormspecSwiftTests/State/
git commit -m "feat(swift): add FieldState and FormState @Observable classes"
```

---

### Task 7: JS Bridge Dispatcher

**Files:**
- Create: `packages/formspec-swift/bridge/dispatcher.ts`
- Create: `packages/formspec-swift/bridge/template.html`
- Create: `packages/formspec-swift/bridge/esbuild.config.mjs`
- Create: `packages/formspec-swift/scripts/build-bridge.sh`

This builds the self-contained HTML bundle that runs inside the hidden `WKWebView`.

**Important context:** The dispatcher must:
1. Import `formspec-engine/render` (the minimal rendering entry — no tools, no studio code)
2. Initialize WASM via `initFormspecEngine()`
3. Create a `FormEngine` from the definition
4. Install signal effects on all fields for reactive state updates
5. Batch changes within a microtask and post them as a single message
6. Listen for commands from Swift via `window.formspecCommand(json)`

**Reference files:**
- `packages/formspec-engine/src/engine-render-entry.ts` — the `/render` entry point
- `packages/formspec-engine/src/wasm-bridge-runtime.ts` — WASM loading
- `packages/formspec-engine/src/field-view-model.ts` — FieldViewModel interface
- `packages/formspec-mcp/package.json` line 27 — esbuild bundling example

- [ ] **Step 1: Write the JS dispatcher**

`packages/formspec-swift/bridge/dispatcher.ts`:

```typescript
/**
 * @filedesc Message dispatcher for the formspec-swift WKWebView bridge.
 * Receives EngineCommands from Swift, drives FormEngine, and posts
 * batched EngineEvents back via webkit.messageHandlers.formspec.
 */
import { createFormEngine, initFormspecEngine } from 'formspec-engine/render';
import type { IFormEngine } from 'formspec-engine/render';
import { effect } from '@preact/signals-core';

// --- Types matching Swift's EngineCommand/EngineEvent ---

interface EngineCommand {
    type: string;
    [key: string]: unknown;
}

interface EngineEvent {
    type: string;
    [key: string]: unknown;
}

// --- Batching ---

let pendingEvents: EngineEvent[] = [];
let batchScheduled = false;

function postEvent(event: EngineEvent) {
    pendingEvents.push(event);
    if (!batchScheduled) {
        batchScheduled = true;
        queueMicrotask(flushEvents);
    }
}

function flushEvents() {
    const batch = pendingEvents;
    pendingEvents = [];
    batchScheduled = false;
    try {
        (window as any).webkit?.messageHandlers?.formspec?.postMessage(JSON.stringify(batch));
    } catch (e) {
        console.error('[formspec-bridge] Failed to post events:', e);
    }
}

// --- Engine lifecycle ---

let engine: IFormEngine | null = null;
let cleanupEffects: (() => void)[] = [];

function installFieldEffects(eng: IFormEngine) {
    // Clean up previous effects
    cleanupEffects.forEach(fn => fn());
    cleanupEffects = [];

    // Install effects on all field signals
    for (const [path, signal] of Object.entries(eng.signals)) {
        const dispose = effect(() => {
            const value = signal.value;
            const relevantSig = eng.relevantSignals[path];
            const requiredSig = eng.requiredSignals[path];
            const readonlySig = eng.readonlySignals[path];
            const errorSig = eng.errorSignals[path];
            const validationSig = eng.validationResults[path];
            const optionSig = eng.optionSignals[path];
            const optionStateSig = eng.optionStateSignals[path];

            const vm = eng.getFieldVM(path);
            if (!vm) return;

            postEvent({
                type: 'fieldStateChanged',
                path,
                changes: {
                    label: vm.label.value,
                    hint: vm.hint.value ?? null,
                    description: vm.description?.value ?? null,
                    value: value ?? null,
                    required: requiredSig?.value ?? false,
                    visible: relevantSig?.value ?? true,
                    readonly: readonlySig?.value ?? false,
                    errors: validationSig?.value?.map((r: any) => ({
                        path: r.path ?? null,
                        message: r.message,
                        severity: r.severity,
                        constraintKind: r.constraintKind ?? null,
                        code: r.code ?? null,
                    })) ?? [],
                    firstError: errorSig?.value ?? null,
                    options: optionSig?.value?.map((o: any) => ({
                        value: o.value,
                        label: o.label,
                    })) ?? [],
                    optionsLoading: optionStateSig?.value?.loading ?? false,
                    optionsError: optionStateSig?.value?.error ?? null,
                },
            });
        });
        cleanupEffects.push(dispose);
    }

    // Form-level state effect
    const formVM = eng.getFormVM();
    const formDispose = effect(() => {
        postEvent({
            type: 'formStateChanged',
            changes: {
                title: formVM.title.value,
                description: formVM.description.value,
                isValid: formVM.isValid.value,
                errors: formVM.validationSummary.value.errors,
                warnings: formVM.validationSummary.value.warnings,
                infos: formVM.validationSummary.value.infos,
            },
        });
    });
    cleanupEffects.push(formDispose);

    // Page-level state effects — emit pageStateChanged for each page
    const def = (eng as any).definition;
    const pages = def?.pages ?? def?.theme?.pages ?? [];
    for (const page of pages) {
        if (!page?.id) continue;
        const pageDispose = effect(() => {
            postEvent({
                type: 'pageStateChanged',
                pageId: page.id,
                title: formVM.pageTitle(page.id).value,
                description: formVM.pageDescription?.(page.id)?.value ?? '',
            });
        });
        cleanupEffects.push(pageDispose);
    }
}

// --- Command handler ---

async function handleCommand(cmd: EngineCommand): Promise<void> {
    switch (cmd.type) {
        case 'initialize': {
            const bundle = cmd.bundle as any;
            await initFormspecEngine();
            engine = createFormEngine(bundle.definition, bundle.runtimeContext ?? undefined, bundle.registry ?? undefined);

            // Load locales — loadLocale takes a single LocaleDocument
            // which contains its own `locale` field internally
            if (bundle.locales) {
                for (const [_code, localeData] of Object.entries(bundle.locales)) {
                    (engine as any).loadLocale?.(localeData);
                }
                if (bundle.defaultLocale) {
                    (engine as any).setLocale?.(bundle.defaultLocale);
                }
            }

            installFieldEffects(engine);
            postEvent({ type: 'engineReady' });
            break;
        }

        case 'setValue': {
            engine?.setValue(cmd.path as string, cmd.value);
            break;
        }

        case 'setLocale': {
            (engine as any).setLocale?.(cmd.languageCode as string);
            // Re-install effects to pick up re-resolved labels
            if (engine) installFieldEffects(engine);
            break;
        }

        case 'setResponse': {
            const data = cmd.data as Record<string, unknown>;
            if (engine && data) {
                for (const [path, value] of Object.entries(data)) {
                    engine.setValue(path, value);
                }
            }
            break;
        }

        case 'touchField': {
            // Touch tracking is Swift-side only in this bridge version
            break;
        }

        case 'addRepeatInstance': {
            const count = engine?.addRepeatInstance(cmd.groupName as string);
            if (count !== undefined) {
                postEvent({ type: 'repeatChanged', groupName: cmd.groupName, count });
                if (engine) installFieldEffects(engine);
            }
            break;
        }

        case 'removeRepeatInstance': {
            engine?.removeRepeatInstance(cmd.groupName as string, cmd.index as number);
            if (engine) {
                const repeats = (engine as any).repeats;
                const count = repeats?.[cmd.groupName as string]?.value ?? 0;
                postEvent({ type: 'repeatChanged', groupName: cmd.groupName, count });
                installFieldEffects(engine);
            }
            break;
        }

        case 'getResponse': {
            const response = engine?.getResponse();
            postEvent({ type: 'responseResult', data: response ?? null });
            break;
        }

        case 'getValidationReport': {
            const report = engine?.getValidationReport({
                mode: (cmd.mode as string) === 'submit' ? 'submit' : 'continuous',
            });
            postEvent({ type: 'validationReportResult', report: report ?? { results: [], isValid: true } });
            break;
        }

        default:
            postEvent({ type: 'engineError', message: `Unknown command: ${cmd.type}` });
    }
}

// Global function called by Swift via evaluateJavaScript
(window as any).formspecCommand = async function (jsonString: string) {
    try {
        const cmd = JSON.parse(jsonString) as EngineCommand;
        await handleCommand(cmd);
    } catch (e) {
        postEvent({ type: 'engineError', message: `Command failed: ${(e as Error).message}` });
    }
};
```

- [ ] **Step 2: Write the HTML template**

`packages/formspec-swift/bridge/template.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
<!-- BRIDGE_SCRIPT_PLACEHOLDER -->
<script>
// Signal to Swift that the page has loaded
window.webkit?.messageHandlers?.formspec?.postMessage(
    JSON.stringify([{"type": "engineReady"}])
);
</script>
</body>
</html>
```

- [ ] **Step 3: Write the esbuild config**

`packages/formspec-swift/bridge/esbuild.config.mjs`:

```javascript
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
    // Bundle dispatcher + formspec-engine/render into a single IIFE
    const result = await esbuild.build({
        entryPoints: [resolve(__dirname, 'dispatcher.ts')],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        write: false,
        minify: true,
        sourcemap: false,
    });

    const jsCode = result.outputFiles[0].text;

    // Read HTML template and inject the bundled JS
    const template = readFileSync(resolve(__dirname, 'template.html'), 'utf-8');
    const html = template.replace(
        '<!-- BRIDGE_SCRIPT_PLACEHOLDER -->',
        `<script>${jsCode}</script>`
    );

    // Write to Swift package resources
    const outPath = resolve(__dirname, '../Sources/FormspecSwift/Resources/formspec-engine.html');
    writeFileSync(outPath, html, 'utf-8');
    console.log(`Bridge bundle written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

build().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Write the build script**

`packages/formspec-swift/scripts/build-bridge.sh`:

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"

echo "Building formspec-swift bridge bundle..."

# Ensure formspec-engine is built
if [ ! -d "$REPO_ROOT/packages/formspec-engine/dist" ]; then
    echo "Building formspec-engine first..."
    npm run build --workspace=formspec-engine --prefix="$REPO_ROOT"
fi

# Run esbuild
cd "$PACKAGE_DIR"
node bridge/esbuild.config.mjs

echo "Bridge bundle built successfully."
```

Make it executable: `chmod +x packages/formspec-swift/scripts/build-bridge.sh`

- [ ] **Step 5: Test the build script**

Run: `cd packages/formspec-swift && bash scripts/build-bridge.sh 2>&1 | tail -5`
Expected: "Bridge bundle built successfully." and `Sources/FormspecSwift/Resources/formspec-engine.html` is updated with real JS content.

- [ ] **Step 6: Verify the HTML bundle contains the dispatcher**

Run: `grep -c "formspecCommand" packages/formspec-swift/Sources/FormspecSwift/Resources/formspec-engine.html`
Expected: At least 1 (the global function name should appear in the bundled JS)

- [ ] **Step 7: Commit**

```bash
git add packages/formspec-swift/bridge/
git add packages/formspec-swift/scripts/
git add packages/formspec-swift/Sources/FormspecSwift/Resources/formspec-engine.html
git commit -m "feat(swift): add JS bridge dispatcher and build script"
```

---

### Task 8: WebView Bridge — WebViewEngine

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Bridge/WebViewEngine.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Bridge/WebViewEngineTests.swift`

The `WebViewEngine` manages the hidden `WKWebView` lifecycle. It loads the HTML bundle, sends commands, and receives batched events.

**Important:** `WKWebView` requires a running app or XCTest host to function. Tests here will be integration tests that need the WebKit framework.

- [ ] **Step 1: Write WebViewEngine tests**

```swift
import XCTest
import WebKit
@testable import FormspecSwift

@MainActor
final class WebViewEngineTests: XCTestCase {

    func testLoadBridgeHTML() async throws {
        let engine = WebViewEngine()
        // The bridge HTML should load without error
        try await engine.loadBridge()
        // After loading, the WebView should be alive
        XCTAssertTrue(engine.isLoaded)
    }

    func testSendCommandBeforeLoad() async {
        let engine = WebViewEngine()
        // Sending a command before loading should throw
        do {
            try await engine.send(.getResponse)
            XCTFail("Expected error")
        } catch {
            // Expected: bridge not loaded
        }
    }

    func testDispose() async throws {
        let engine = WebViewEngine()
        try await engine.loadBridge()
        engine.dispose()
        XCTAssertFalse(engine.isLoaded)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter WebViewEngineTests 2>&1 | tail -10`
Expected: Compilation error — `WebViewEngine` not defined

- [ ] **Step 3: Implement WebViewEngine**

```swift
import Foundation
import WebKit

/// Internal bridge that manages a hidden WKWebView running formspec-engine + WASM.
/// Not public API — consumers interact with FormspecEngine.
@MainActor
final class WebViewEngine: NSObject {
    private var webView: WKWebView?
    private var eventHandler: (([EngineEvent]) -> Void)?
    private var loadContinuation: CheckedContinuation<Void, Error>?

    private(set) var isLoaded = false

    /// Set the handler for events received from the JS bridge.
    func onEvents(_ handler: @escaping ([EngineEvent]) -> Void) {
        self.eventHandler = handler
    }

    /// Load the bridge HTML bundle into the WKWebView.
    func loadBridge() async throws {
        let config = WKWebViewConfiguration()
        let handler = MessageHandler { [weak self] events in
            self?.eventHandler?(events)
        }
        config.userContentController.add(handler, name: "formspec")

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        self.webView = wv

        // Load the bundled HTML resource
        guard let htmlURL = Bundle.module.url(forResource: "formspec-engine", withExtension: "html") else {
            throw FormspecError.engineLoadFailed(message: "formspec-engine.html not found in bundle")
        }
        let html = try String(contentsOf: htmlURL, encoding: .utf8)

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.loadContinuation = continuation
            wv.loadHTMLString(html, baseURL: nil)
        }
        isLoaded = true
    }

    /// Send a command to the JS engine.
    func send(_ command: EngineCommand) async throws {
        guard let wv = webView, isLoaded else {
            throw FormspecError.bridgeDisconnected
        }
        let data = try JSONEncoder().encode(command)
        let jsonString = String(data: data, encoding: .utf8)!
        let escaped = jsonString
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let js = "window.formspecCommand('\(escaped)')"
        try await wv.evaluateJavaScript(js)
    }

    /// Tear down the WebView.
    func dispose() {
        webView?.configuration.userContentController.removeAllScriptMessageHandlers()
        webView?.stopLoading()
        webView = nil
        isLoaded = false
    }

    deinit {
        // WKWebView cleanup should happen on MainActor via dispose()
        // but deinit is a safety net
    }
}

// MARK: - WKNavigationDelegate

extension WebViewEngine: WKNavigationDelegate {
    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            loadContinuation?.resume()
            loadContinuation = nil
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            loadContinuation?.resume(throwing: FormspecError.engineLoadFailed(message: error.localizedDescription))
            loadContinuation = nil
        }
    }

    nonisolated func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Task { @MainActor in
            isLoaded = false
            eventHandler?([.engineError(message: "WebView process terminated")])
        }
    }
}

// MARK: - Message Handler

private final class MessageHandler: NSObject, WKScriptMessageHandler {
    let handler: ([EngineEvent]) -> Void

    init(handler: @escaping ([EngineEvent]) -> Void) {
        self.handler = handler
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String,
              let data = body.data(using: .utf8) else { return }
        do {
            let events = try JSONDecoder().decode([EngineEvent].self, from: data)
            handler(events)
        } catch {
            handler([.engineError(message: "Failed to decode events: \(error.localizedDescription)")])
        }
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/formspec-swift && swift test --filter WebViewEngineTests 2>&1 | tail -10`

Note: These tests require a macOS host with WebKit. They may not pass in headless CI. If they fail due to missing UI context, mark them with `@available(macOS 14, *)` and skip on CI.

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Bridge/WebViewEngine.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/Bridge/WebViewEngineTests.swift
git commit -m "feat(swift): add WebViewEngine bridge (hidden WKWebView)"
```

---

### Task 9: FormspecEngine — The Public API

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/State/FormspecEngine.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/State/FormspecEngineTests.swift`

This is the main public type. It owns the `WebViewEngine`, manages `FieldState`/`FormState` objects, and exposes the consumer-facing API.

- [ ] **Step 1: Write FormspecEngine tests**

```swift
import XCTest
@testable import FormspecSwift

@MainActor
final class FormspecEngineTests: XCTestCase {

    /// Test that the engine processes a batch of field state events correctly
    func testProcessFieldStateEvents() {
        let engine = FormspecEngine(rootLayoutNode: makeTestLayoutNode())
        let events: [EngineEvent] = [
            .fieldStateChanged(path: "name", changes: FieldStatePatch(
                label: "Full Name", hint: nil, description: nil,
                value: .string("Alice"), required: true, visible: true,
                readonly: false, errors: [], firstError: nil,
                options: nil, optionsLoading: nil, optionsError: nil
            )),
            .engineReady
        ]

        engine.processEvents(events)

        let state = engine.fieldState(for: "name")
        XCTAssertNotNil(state)
        XCTAssertEqual(state?.label, "Full Name")
        XCTAssertEqual(state?.value as? String, "Alice")
        XCTAssertTrue(state?.required ?? false)
    }

    /// Test that form state events update FormState
    func testProcessFormStateEvents() {
        let engine = FormspecEngine(rootLayoutNode: makeTestLayoutNode())
        engine.processEvents([
            .formStateChanged(changes: FormStatePatch(
                title: "My Form", description: "Desc", isValid: false,
                errors: 1, warnings: 0, infos: 0
            ))
        ])

        XCTAssertEqual(engine.formState.title, "My Form")
        XCTAssertFalse(engine.formState.isValid)
        XCTAssertEqual(engine.formState.validationSummary.errors, 1)
    }

    /// Test that fieldState(for:) returns nil for unknown paths
    func testFieldStateForUnknownPath() {
        let engine = FormspecEngine(rootLayoutNode: makeTestLayoutNode())
        XCTAssertNil(engine.fieldState(for: "nonexistent"))
    }

    /// Test that repeat changed events update field state cache
    func testRepeatChangedCreatesNewPaths() {
        let engine = FormspecEngine(rootLayoutNode: makeTestLayoutNode())
        engine.processEvents([
            .repeatChanged(groupName: "members", count: 2),
            .fieldStateChanged(path: "members[0].name", changes: FieldStatePatch(
                label: "Name", hint: nil, description: nil, value: nil,
                required: true, visible: true, readonly: false,
                errors: [], firstError: nil, options: nil, optionsLoading: nil, optionsError: nil
            )),
            .fieldStateChanged(path: "members[1].name", changes: FieldStatePatch(
                label: "Name", hint: nil, description: nil, value: nil,
                required: true, visible: true, readonly: false,
                errors: [], firstError: nil, options: nil, optionsLoading: nil, optionsError: nil
            ))
        ])

        XCTAssertNotNil(engine.fieldState(for: "members[0].name"))
        XCTAssertNotNil(engine.fieldState(for: "members[1].name"))
    }

    // MARK: - Helpers

    private func makeTestLayoutNode() -> LayoutNode {
        LayoutNode(
            id: "root", component: "Stack", category: .layout,
            props: [:], style: nil, cssClasses: [], accessibility: nil,
            children: [], bindPath: nil, fieldItem: nil, presentation: nil,
            labelPosition: nil, when: nil, whenPrefix: nil, fallback: nil,
            repeatGroup: nil, repeatPath: nil, isRepeatTemplate: nil
        )
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter FormspecEngineTests 2>&1 | tail -10`
Expected: Compilation error

- [ ] **Step 3: Implement FormspecEngine**

```swift
import Foundation

/// The main entry point for rendering formspec forms in SwiftUI.
/// Manages field/form state and communicates with the JS engine via a hidden WebView.
@MainActor @Observable
public final class FormspecEngine {

    /// Form-level reactive state
    public let formState: FormState

    /// The root layout node (decoded from the pre-generated layout plan)
    public let rootLayoutNode: LayoutNode

    /// Current locale
    public private(set) var currentLocale: String = "en"

    /// Available locales from the rendering bundle
    public private(set) var availableLocales: [String] = []

    // Internal state
    private var fieldStateCache: [String: FieldState] = [:]
    private var bridge: WebViewEngine?
    private var bundle: RenderingBundle?

    /// Internal init for testing (no bridge)
    init(rootLayoutNode: LayoutNode) {
        self.rootLayoutNode = rootLayoutNode
        self.formState = FormState()
    }

    /// Create a FormspecEngine from a RenderingBundle.
    /// Loads the WebView, initializes the JS engine, and returns when ready.
    public static func create(bundle: RenderingBundle) async throws -> FormspecEngine {
        // Decode the layout plan
        let layoutData = try JSONEncoder().encode(bundle.layoutPlan)
        let rootNode = try JSONDecoder().decode(LayoutNode.self, from: layoutData)

        let engine = FormspecEngine(rootLayoutNode: rootNode)
        engine.bundle = bundle
        engine.availableLocales = bundle.locales.map { Array($0.keys) } ?? []
        engine.currentLocale = bundle.defaultLocale ?? "en"

        // Set up bridge
        let bridge = WebViewEngine()
        engine.bridge = bridge

        // Wait for events via continuation
        let readyContinuation = ReadyContinuation()
        bridge.onEvents { events in
            engine.processEvents(events)
            if events.contains(where: { if case .engineReady = $0 { return true }; return false }) {
                readyContinuation.resume()
            }
        }

        try await bridge.loadBridge()
        try await bridge.send(.initialize(bundle))

        // Wait for engineReady event
        try await readyContinuation.wait(timeout: 10.0)

        return engine
    }

    // MARK: - Field State

    /// Get the reactive state for a field at the given path.
    /// Returns nil if no field exists at that path.
    /// Lazily creates and caches FieldState objects from bridge events.
    public func fieldState(for path: String) -> FieldState? {
        fieldStateCache[path]
    }

    // MARK: - Mutations

    public func setValue(_ path: String, value: Any?) {
        let jsonValue = anyToJSONValue(value)
        Task { try? await bridge?.send(.setValue(path: path, value: jsonValue)) }
    }

    public func setLocale(_ languageCode: String) {
        currentLocale = languageCode
        Task { try? await bridge?.send(.setLocale(languageCode: languageCode)) }
    }

    public func setResponse(_ data: JSONValue) {
        Task { try? await bridge?.send(.setResponse(data)) }
    }

    public func addRepeatInstance(_ groupName: String) -> Int? {
        Task { try? await bridge?.send(.addRepeatInstance(groupName: groupName)) }
        return nil // actual count comes back via repeatChanged event
    }

    public func removeRepeatInstance(_ groupName: String, at index: Int) {
        Task { try? await bridge?.send(.removeRepeatInstance(groupName: groupName, index: index)) }
    }

    func touchField(_ path: String) {
        Task { try? await bridge?.send(.touchField(path: path)) }
    }

    // MARK: - Queries (async request/response via bridge)

    private var pendingResponseContinuation: CheckedContinuation<JSONValue, Never>?
    private var pendingReportContinuation: CheckedContinuation<ValidationReport, Never>?

    public func getResponse() async -> JSONValue {
        guard bridge != nil else { return .null }
        return await withCheckedContinuation { continuation in
            self.pendingResponseContinuation = continuation
            Task { try? await bridge?.send(.getResponse) }
        }
    }

    public func getValidationReport(mode: ValidationMode = .continuous) async -> ValidationReport {
        guard bridge != nil else { return ValidationReport(results: [], isValid: true) }
        let modeStr = mode == .submit ? "submit" : "continuous"
        return await withCheckedContinuation { continuation in
            self.pendingReportContinuation = continuation
            Task { try? await bridge?.send(.getValidationReport(mode: modeStr)) }
        }
    }

    // MARK: - Lifecycle

    public func dispose() {
        bridge?.dispose()
        bridge = nil
        fieldStateCache.removeAll()
    }

    deinit {
        bridge?.dispose()
    }

    // MARK: - Event Processing (internal)

    func processEvents(_ events: [EngineEvent]) {
        for event in events {
            switch event {
            case .fieldStateChanged(let path, let changes):
                let state = fieldStateCache[path] ?? createFieldState(path: path)
                state.apply(patch: changes)

            case .formStateChanged(let changes):
                formState.apply(patch: changes)

            case .pageStateChanged(let pageId, let title, let description):
                formState.setPageTitle(pageId, title: title)
                formState.setPageDescription(pageId, description: description)

            case .repeatChanged(_, _):
                // Repeat changes trigger new fieldStateChanged events for new paths
                break

            case .responseResult(let data):
                pendingResponseContinuation?.resume(returning: data)
                pendingResponseContinuation = nil

            case .validationReportResult(let report):
                pendingReportContinuation?.resume(returning: report)
                pendingReportContinuation = nil

            case .engineReady:
                break

            case .engineError(let message):
                print("[FormspecSwift] Engine error: \(message)")
            }
        }
    }

    // MARK: - Private

    private func createFieldState(path: String) -> FieldState {
        let state = FieldState(
            templatePath: path,
            instancePath: path,
            id: "field-\(path)",
            itemKey: path.components(separatedBy: ".").last ?? path,
            dataType: "string",
            disabledDisplay: .hidden,
            engine: self
        )
        fieldStateCache[path] = state
        return state
    }

    private func anyToJSONValue(_ value: Any?) -> JSONValue? {
        guard let value else { return nil }
        switch value {
        case let s as String: return .string(s)
        case let n as Double: return .number(n)
        case let n as Int: return .number(Double(n))
        case let b as Bool: return .bool(b)
        default: return nil
        }
    }
}

// MARK: - Ready Continuation Helper

@MainActor
private final class ReadyContinuation {
    private var continuation: CheckedContinuation<Void, Error>?
    private var resolved = false

    func resume() {
        guard !resolved else { return }
        resolved = true
        continuation?.resume()
        continuation = nil
    }

    func wait(timeout: TimeInterval) async throws {
        if resolved { return }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.continuation = cont

            // Timeout
            Task {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                if !self.resolved {
                    self.resolved = true
                    cont.resume(throwing: FormspecError.bridgeTimeout)
                }
            }
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter FormspecEngineTests 2>&1 | tail -10`
Expected: All tests pass (the tests use the internal init, no WebView needed)

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/State/FormspecEngine.swift
git add packages/formspec-swift/Tests/FormspecSwiftTests/State/FormspecEngineTests.swift
git commit -m "feat(swift): add FormspecEngine public API"
```

---

### Task 10: Component Map & Renderer

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Renderer/ComponentMap.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Renderer/FormspecForm.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Renderer/FormspecField.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Renderer/FormspecLayout.swift`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Renderer/ComponentMapTests.swift`

- [ ] **Step 1: Write ComponentMap tests**

```swift
import XCTest
import SwiftUI
@testable import FormspecSwift

final class ComponentMapTests: XCTestCase {

    func testDefaultMapHasTextInput() {
        let map = ComponentMap.defaults
        XCTAssertNotNil(map.fields["TextInput"])
    }

    func testDefaultMapHasStack() {
        let map = ComponentMap.defaults
        XCTAssertNotNil(map.layout["Stack"])
    }

    func testReplacingFieldComponent() {
        let map = ComponentMap.defaults
            .replacing(field: "TextInput", with: MockFieldComponent.self)
        // The type should be replaced
        XCTAssertNotNil(map.fields["TextInput"])
    }

    func testReplacingLayoutComponent() {
        let map = ComponentMap.defaults
            .replacing(layout: "Stack", with: MockLayoutComponent.self)
        XCTAssertNotNil(map.layout["Stack"])
    }
}

// Mock components for testing
private struct MockFieldComponent: FieldComponent {
    let state: FieldState
    let node: LayoutNode
    var body: some View { Text("mock") }
}

private struct MockLayoutComponent: LayoutComponent {
    let node: LayoutNode
    let children: [AnyView]
    var body: some View { Text("mock") }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/formspec-swift && swift test --filter ComponentMapTests 2>&1 | tail -10`
Expected: Compilation error

- [ ] **Step 3: Implement ComponentMap and protocols**

`Sources/FormspecSwift/Renderer/ComponentMap.swift`:

```swift
import SwiftUI

/// Protocol for custom field components.
public protocol FieldComponent: View {
    init(state: FieldState, node: LayoutNode)
}

/// Protocol for custom layout components.
public protocol LayoutComponent: View {
    init(node: LayoutNode, children: [AnyView])
}

/// Maps LayoutNode component names to SwiftUI view types.
public struct ComponentMap: @unchecked Sendable {
    public var fields: [String: any FieldComponent.Type]
    public var layout: [String: any LayoutComponent.Type]

    public static let defaults = ComponentMap(
        fields: [
            "TextInput": DefaultTextInput.self,
            "NumberInput": DefaultNumberInput.self,
            "TextArea": DefaultTextArea.self,
            "Checkbox": DefaultCheckbox.self,
            "Select": DefaultSelect.self,
            "MultiSelect": DefaultMultiSelect.self,
            "RadioGroup": DefaultRadioGroup.self,
            "DateInput": DefaultDateInput.self,
        ],
        layout: [
            "Stack": DefaultStack.self,
            "Card": DefaultCard.self,
            "Grid": DefaultGrid.self,
            "Page": DefaultPage.self,
            "Wizard": DefaultWizard.self,
        ]
    )

    public func replacing(field key: String, with type: any FieldComponent.Type) -> ComponentMap {
        var copy = self
        copy.fields[key] = type
        return copy
    }

    public func replacing(layout key: String, with type: any LayoutComponent.Type) -> ComponentMap {
        var copy = self
        copy.layout[key] = type
        return copy
    }
}
```

- [ ] **Step 4: Implement FormspecForm, FormspecField, FormspecLayout**

`Sources/FormspecSwift/Renderer/FormspecForm.swift`:

```swift
import SwiftUI

/// Drop-in auto-renderer. Walks the LayoutNode tree and renders native SwiftUI.
public struct FormspecForm: View {
    let engine: FormspecEngine
    var components: ComponentMap

    public init(engine: FormspecEngine, components: ComponentMap = .defaults) {
        self.engine = engine
        self.components = components
    }

    public var body: some View {
        FormspecLayout(node: engine.rootLayoutNode, engine: engine, components: components)
    }
}
```

`Sources/FormspecSwift/Renderer/FormspecField.swift`:

```swift
import SwiftUI

/// Renders a single field node by dispatching to the component map.
struct FormspecField: View {
    let node: LayoutNode
    let engine: FormspecEngine
    let components: ComponentMap

    var body: some View {
        if let bindPath = node.bindPath, let state = engine.fieldState(for: bindPath) {
            if state.visible {
                if let componentType = components.fields[node.component] {
                    AnyView(componentType.init(state: state, node: node))
                } else {
                    // Fallback: render as text input
                    AnyView(DefaultTextInput(state: state, node: node))
                }
            }
        }
    }
}
```

`Sources/FormspecSwift/Renderer/FormspecLayout.swift`:

```swift
import SwiftUI

/// Renders a layout node and its children recursively.
struct FormspecLayout: View {
    let node: LayoutNode
    let engine: FormspecEngine
    let components: ComponentMap

    var body: some View {
        switch node.category {
        case .field:
            FormspecField(node: node, engine: engine, components: components)

        case .layout:
            if let componentType = components.layout[node.component] {
                AnyView(componentType.init(
                    node: node,
                    children: node.children.map { child in
                        AnyView(FormspecLayout(node: child, engine: engine, components: components))
                    }
                ))
            } else {
                // Fallback: vertical stack
                AnyView(DefaultStack(
                    node: node,
                    children: node.children.map { child in
                        AnyView(FormspecLayout(node: child, engine: engine, components: components))
                    }
                ))
            }

        case .display, .interactive, .special:
            // Render children if any
            ForEach(node.children.indices, id: \.self) { index in
                FormspecLayout(node: node.children[index], engine: engine, components: components)
            }
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/formspec-swift && swift test --filter ComponentMapTests 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Renderer/
git add packages/formspec-swift/Tests/FormspecSwiftTests/Renderer/
git commit -m "feat(swift): add ComponentMap, FormspecForm, and renderer"
```

---

### Task 11: Default SwiftUI Components

**Files:**
- Create: `packages/formspec-swift/Sources/FormspecSwift/Components/DefaultFieldComponents.swift`
- Create: `packages/formspec-swift/Sources/FormspecSwift/Components/DefaultLayoutComponents.swift`

These are the built-in SwiftUI views that render common field and layout types with full accessibility support.

- [ ] **Step 1: Implement default field components**

```swift
import SwiftUI

// MARK: - Text Input

public struct DefaultTextInput: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label)
                    .font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            if let hint = state.hint {
                Text(hint).font(.caption).foregroundColor(.secondary)
            }
            TextField("", text: Binding(
                get: { state.value as? String ?? "" },
                set: { state.setValue($0) }
            ))
            .textFieldStyle(.roundedBorder)
            .disabled(state.readonly)
            .accessibilityLabel(state.label)
            .accessibilityHint(state.hint ?? "")

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
                    .accessibilityLabel("Error: \(error)")
            }
        }
    }
}

// MARK: - Number Input

public struct DefaultNumberInput: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            TextField("", text: Binding(
                get: {
                    if let n = state.value as? Double { return String(n) }
                    return ""
                },
                set: { state.setValue(Double($0)) }
            ))
            .textFieldStyle(.roundedBorder)
            .keyboardType(.decimalPad)
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }
}

// MARK: - TextArea

public struct DefaultTextArea: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            TextEditor(text: Binding(
                get: { state.value as? String ?? "" },
                set: { state.setValue($0) }
            ))
            .frame(minHeight: 80)
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }
}

// MARK: - Checkbox (Toggle)

public struct DefaultCheckbox: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Toggle(isOn: Binding(
                get: { state.value as? Bool ?? false },
                set: { state.setValue($0) }
            )) {
                HStack(spacing: 2) {
                    Text(state.label)
                    if state.required { Text("*").foregroundColor(.red) }
                }
            }
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }
}

// MARK: - Select (Picker)

public struct DefaultSelect: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            Picker("", selection: Binding(
                get: { selectedValue },
                set: { state.setValue($0) }
            )) {
                Text("Select...").tag("" as String)
                ForEach(state.options, id: \.label) { option in
                    Text(option.label).tag(option.value.stringValue ?? "")
                }
            }
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if state.optionsLoading {
                ProgressView().scaleEffect(0.8)
            }
            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }

    private var selectedValue: String {
        if let v = state.value as? String { return v }
        return ""
    }
}

// MARK: - MultiSelect

public struct DefaultMultiSelect: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            ForEach(state.options, id: \.label) { option in
                Toggle(isOn: Binding(
                    get: { selectedValues.contains(option.value.stringValue ?? "") },
                    set: { isOn in toggleOption(option, isOn: isOn) }
                )) {
                    Text(option.label)
                }
                .disabled(state.readonly)
            }
            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
        .accessibilityLabel(state.label)
    }

    private var selectedValues: Set<String> {
        guard let arr = state.value as? [Any] else { return [] }
        return Set(arr.compactMap { $0 as? String })
    }

    private func toggleOption(_ option: ResolvedOption, isOn: Bool) {
        var current = selectedValues
        let val = option.value.stringValue ?? ""
        if isOn { current.insert(val) } else { current.remove(val) }
        state.setValue(Array(current))
    }
}

// MARK: - RadioGroup

public struct DefaultRadioGroup: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            Picker("", selection: Binding(
                get: { state.value as? String ?? "" },
                set: { state.setValue($0) }
            )) {
                ForEach(state.options, id: \.label) { option in
                    Text(option.label).tag(option.value.stringValue ?? "")
                }
            }
            .pickerStyle(.segmented)
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }
}

// MARK: - Date Input

public struct DefaultDateInput: FieldComponent {
    public let state: FieldState
    public let node: LayoutNode

    public init(state: FieldState, node: LayoutNode) {
        self.state = state
        self.node = node
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 2) {
                Text(state.label).font(.subheadline)
                if state.required { Text("*").foregroundColor(.red) }
            }
            DatePicker("", selection: Binding(
                get: { Date() }, // TODO: parse ISO date from value
                set: { _ in } // TODO: format to ISO and setValue
            ), displayedComponents: .date)
            .labelsHidden()
            .disabled(state.readonly)
            .accessibilityLabel(state.label)

            if let error = state.firstError {
                Text(error).font(.caption).foregroundColor(.red)
            }
        }
    }
}
```

- [ ] **Step 2: Implement default layout components**

```swift
import SwiftUI

// MARK: - Stack

public struct DefaultStack: LayoutComponent {
    public let node: LayoutNode
    public let children: [AnyView]

    public init(node: LayoutNode, children: [AnyView]) {
        self.node = node
        self.children = children
    }

    public var body: some View {
        let direction = node.props["direction"]?.stringValue ?? "vertical"
        if direction == "horizontal" {
            HStack(alignment: .top, spacing: 12) {
                ForEach(children.indices, id: \.self) { i in children[i] }
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(children.indices, id: \.self) { i in children[i] }
            }
        }
    }
}

// MARK: - Card

public struct DefaultCard: LayoutComponent {
    public let node: LayoutNode
    public let children: [AnyView]

    public init(node: LayoutNode, children: [AnyView]) {
        self.node = node
        self.children = children
    }

    public var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(children.indices, id: \.self) { i in children[i] }
            }
        } label: {
            if let title = node.props["title"]?.stringValue {
                Text(title).font(.headline)
            }
        }
    }
}
```

- [ ] **Step 3: Implement remaining layout components**

Add to `DefaultLayoutComponents.swift`:

```swift
// MARK: - Grid

public struct DefaultGrid: LayoutComponent {
    public let node: LayoutNode
    public let children: [AnyView]

    public init(node: LayoutNode, children: [AnyView]) {
        self.node = node
        self.children = children
    }

    public var body: some View {
        let columns = Int(node.props["columns"]?.numberValue ?? 2)
        let gridColumns = Array(repeating: GridItem(.flexible()), count: columns)
        LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(children.indices, id: \.self) { i in children[i] }
        }
    }
}

// MARK: - Page

public struct DefaultPage: LayoutComponent {
    public let node: LayoutNode
    public let children: [AnyView]

    public init(node: LayoutNode, children: [AnyView]) {
        self.node = node
        self.children = children
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let title = node.props["title"]?.stringValue {
                Text(title).font(.title2).fontWeight(.semibold)
            }
            if let description = node.props["description"]?.stringValue {
                Text(description).font(.body).foregroundColor(.secondary)
            }
            ForEach(children.indices, id: \.self) { i in children[i] }
        }
        .padding()
    }
}

// MARK: - Wizard

public struct DefaultWizard: LayoutComponent {
    public let node: LayoutNode
    public let children: [AnyView]

    public init(node: LayoutNode, children: [AnyView]) {
        self.node = node
        self.children = children
    }

    public var body: some View {
        TabView {
            ForEach(children.indices, id: \.self) { i in
                children[i].tag(i)
            }
        }
        .tabViewStyle(.page)
    }
}
```

- [ ] **Step 4: Verify package compiles**

Run: `cd packages/formspec-swift && swift build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/formspec-swift/Sources/FormspecSwift/Components/
git commit -m "feat(swift): add default SwiftUI field and layout components"
```

---

### Task 12: Integration Test Fixtures & Smoke Test

**Files:**
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Fixtures/simple-form.definition.json`
- Create: `packages/formspec-swift/Tests/FormspecSwiftTests/Fixtures/simple-form.locale.en.json`
- Modify: `packages/formspec-swift/Tests/FormspecSwiftTests/State/FormspecEngineTests.swift`

Create realistic test fixtures and a smoke test that exercises the full event processing pipeline.

- [ ] **Step 1: Create test fixtures**

`Tests/FormspecSwiftTests/Fixtures/simple-form.definition.json`:

```json
{
    "formId": "contact",
    "title": "Contact Form",
    "items": [
        {
            "key": "fullName",
            "type": "input",
            "dataType": "string",
            "label": "Full Name",
            "bind": { "required": "true()" }
        },
        {
            "key": "email",
            "type": "input",
            "dataType": "string",
            "label": "Email",
            "bind": { "required": "true()", "constraint": "regex($value, '^[^@]+@[^@]+$')" }
        },
        {
            "key": "subscribe",
            "type": "input",
            "dataType": "boolean",
            "label": "Subscribe to newsletter"
        }
    ]
}
```

`Tests/FormspecSwiftTests/Fixtures/simple-form.locale.en.json`:

```json
{
    "$formspecLocale": "1.0",
    "locale": "en",
    "version": "1.0.0",
    "targetDefinition": "contact",
    "strings": {}
}
```

- [ ] **Step 2: Write integration smoke test**

Add to `FormspecEngineTests.swift`:

```swift
    /// Smoke test: simulate a realistic sequence of bridge events
    func testFullEventSequence() {
        let engine = FormspecEngine(rootLayoutNode: makeTestLayoutNode())

        // Simulate the batch that arrives after initialize + engineReady
        engine.processEvents([
            .formStateChanged(changes: FormStatePatch(
                title: "Contact Form", description: "Please fill in your details",
                isValid: false, errors: 2, warnings: 0, infos: 0
            )),
            .fieldStateChanged(path: "fullName", changes: FieldStatePatch(
                label: "Full Name", hint: nil, description: nil,
                value: .null, required: true, visible: true, readonly: false,
                errors: [
                    ResolvedValidationResult(path: "fullName", message: "Required", severity: .error, constraintKind: "required", code: "required")
                ], firstError: "Required",
                options: nil, optionsLoading: nil, optionsError: nil
            )),
            .fieldStateChanged(path: "email", changes: FieldStatePatch(
                label: "Email", hint: nil, description: nil,
                value: .null, required: true, visible: true, readonly: false,
                errors: [
                    ResolvedValidationResult(path: "email", message: "Required", severity: .error, constraintKind: "required", code: "required")
                ], firstError: "Required",
                options: nil, optionsLoading: nil, optionsError: nil
            )),
            .fieldStateChanged(path: "subscribe", changes: FieldStatePatch(
                label: "Subscribe to newsletter", hint: nil, description: nil,
                value: .bool(false), required: false, visible: true, readonly: false,
                errors: [], firstError: nil,
                options: nil, optionsLoading: nil, optionsError: nil
            )),
            .engineReady
        ])

        // Verify form state
        XCTAssertEqual(engine.formState.title, "Contact Form")
        XCTAssertFalse(engine.formState.isValid)
        XCTAssertEqual(engine.formState.validationSummary.errors, 2)

        // Verify field states
        let name = engine.fieldState(for: "fullName")
        XCTAssertNotNil(name)
        XCTAssertEqual(name?.label, "Full Name")
        XCTAssertTrue(name?.required ?? false)
        XCTAssertEqual(name?.firstError, "Required")

        let email = engine.fieldState(for: "email")
        XCTAssertNotNil(email)
        XCTAssertEqual(email?.label, "Email")

        let subscribe = engine.fieldState(for: "subscribe")
        XCTAssertEqual(subscribe?.value as? Bool, false)
        XCTAssertFalse(subscribe?.required ?? true)
        XCTAssertNil(subscribe?.firstError)

        // Simulate user typing into fullName — new event batch
        engine.processEvents([
            .fieldStateChanged(path: "fullName", changes: FieldStatePatch(
                label: nil, hint: nil, description: nil,
                value: .string("Alice"), required: nil, visible: nil, readonly: nil,
                errors: [], firstError: nil,
                options: nil, optionsLoading: nil, optionsError: nil
            )),
            .formStateChanged(changes: FormStatePatch(
                title: nil, description: nil, isValid: false,
                errors: 1, warnings: nil, infos: nil
            ))
        ])

        // Verify updates
        XCTAssertEqual(name?.value as? String, "Alice")
        XCTAssertNil(name?.firstError) // error cleared
        XCTAssertEqual(engine.formState.validationSummary.errors, 1)
    }
```

- [ ] **Step 3: Run all tests**

Run: `cd packages/formspec-swift && swift test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/formspec-swift/Tests/
git commit -m "test(swift): add integration smoke test and fixtures"
```

---

### Task 13: Public API Barrel & Final Verification

**Files:**
- Modify: `packages/formspec-swift/Sources/FormspecSwift/FormspecSwift.swift`

Export everything from the barrel file so consumers can `import FormspecSwift`.

- [ ] **Step 1: Update the barrel to re-export all public types**

```swift
/// Formspec Swift — Native SwiftUI form renderer.
///
/// Uses a hidden WKWebView bridge to the formspec-engine + WASM runtime.
/// Provides @Observable state objects that SwiftUI views bind to directly,
/// plus an auto-renderer with a customizable component map.
///
/// ## Quick Start
///
/// ```swift
/// let bundle = RenderingBundle(
///     definition: loadJSON("form.definition"),
///     layoutPlan: loadJSON("form.layout")
/// )
/// let engine = try await FormspecEngine.create(bundle: bundle)
/// FormspecForm(engine: engine)
/// ```

// Types
@_exported import struct FormspecSwift.JSONValue
@_exported import struct FormspecSwift.LayoutNode
@_exported import struct FormspecSwift.RenderingBundle
@_exported import struct FormspecSwift.RuntimeContext
@_exported import struct FormspecSwift.ValidationReport
@_exported import struct FormspecSwift.ValidationSummary
@_exported import struct FormspecSwift.ResolvedValidationResult
@_exported import struct FormspecSwift.ResolvedOption
@_exported import enum FormspecSwift.ValidationMode
@_exported import enum FormspecSwift.ValidationSeverity
@_exported import enum FormspecSwift.DisabledDisplay
@_exported import enum FormspecSwift.NodeCategory
@_exported import enum FormspecSwift.LabelPosition
@_exported import struct FormspecSwift.Presentation
@_exported import struct FormspecSwift.AccessibilityInfo
@_exported import struct FormspecSwift.FieldItemInfo

// State
@_exported import class FormspecSwift.FormspecEngine
@_exported import class FormspecSwift.FieldState
@_exported import class FormspecSwift.FormState

// Renderer
@_exported import struct FormspecSwift.FormspecForm
@_exported import struct FormspecSwift.ComponentMap
@_exported import protocol FormspecSwift.FieldComponent
@_exported import protocol FormspecSwift.LayoutComponent

// Errors
@_exported import enum FormspecSwift.FormspecError
```

- [ ] **Step 2: Run full test suite**

Run: `cd packages/formspec-swift && swift test 2>&1 | tail -20`
Expected: All tests pass, build succeeds

- [ ] **Step 3: Verify the bridge HTML exists**

Run: `ls -la packages/formspec-swift/Sources/FormspecSwift/Resources/formspec-engine.html`
Expected: File exists (either placeholder or built bundle)

- [ ] **Step 4: Final commit**

```bash
git add packages/formspec-swift/
git commit -m "feat(swift): complete formspec-swift v0.1.0 package"
```

---

## Notes for Implementation

### WASM in WKWebView

The HTML bundle must handle WASM loading within the `WKWebView` sandbox. Two approaches:
1. **Base64-inline the WASM** — larger HTML file but simpler (no fetch needed)
2. **Load from data URL** — the esbuild config can convert the `.wasm` to a data URL

Start with base64-inlining. Optimize later if bundle size is a problem.

### Testing without a real WebView

Most tests use `FormspecEngine`'s internal `init(rootLayoutNode:)` and `processEvents()` to test the state management layer without a live `WKWebView`. Only `WebViewEngineTests` needs the actual WebKit framework, and those tests may need to be skipped in headless CI environments.

### Build order

The bridge JS bundle depends on `formspec-engine` being built first. The build sequence is:
1. `npm run build --workspace=formspec-engine` (builds TS + WASM)
2. `bash packages/formspec-swift/scripts/build-bridge.sh` (bundles JS into HTML)
3. `cd packages/formspec-swift && swift build` (compiles Swift package with HTML resource)
