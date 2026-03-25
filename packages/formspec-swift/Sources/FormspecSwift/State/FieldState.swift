/// @filedesc FieldState — @Observable class tracking a single field's reactive state for SwiftUI binding.

import Foundation
import Observation

// MARK: - FieldStateDelegate

/// Receives callbacks when a field's value is changed or touched from Swift.
///
/// `FormspecEngine` will conform to this in Task 9. Defined here so `FieldState`
/// can hold a weak reference without a forward dependency on `FormspecEngine`.
public protocol FieldStateDelegate: AnyObject {
    /// Called when the user sets a field value via `FieldState.setValue(_:)`.
    func fieldDidSetValue(_ path: String, value: Any?)
    /// Called when the user touches a field via `FieldState.touch()`.
    func fieldDidTouch(_ path: String)
}

// MARK: - FieldState

/// Reactive state for a single form field, designed for SwiftUI binding via `@Observable`.
///
/// Identity properties (`templatePath`, `instancePath`, `id`, `itemKey`, `dataType`,
/// `disabledDisplay`) are set at init and never change. All other properties are updated
/// by calling `apply(patch:)` from the engine bridge. The `touched` flag is managed
/// exclusively on the Swift side and is never overwritten by patches.
@Observable
public final class FieldState: @unchecked Sendable {

    // MARK: - Identity (stable, set at init)

    /// The template-level path (no repeat indices).
    public let templatePath: String

    /// The fully-qualified instance path (includes repeat indices for repeated groups).
    public let instancePath: String

    /// A stable identifier for this field instance.
    public let id: String

    /// The key identifying the item in the definition.
    public let itemKey: String

    /// The field's data type (e.g. `"text"`, `"number"`, `"date"`).
    public let dataType: String

    /// How the field is presented when it is disabled (not reactive — set once at init).
    public let disabledDisplay: DisabledDisplay

    // MARK: - Presentation (reactive)

    /// The field's display label.
    public private(set) var label: String = ""

    /// An optional short hint shown inside the input.
    public private(set) var hint: String?

    /// An optional longer description shown near the field.
    public private(set) var description: String?

    // MARK: - State (reactive)

    /// The current field value as a native Swift type.
    ///
    /// `JSONValue.null` patches set this to `nil`. Other `JSONValue` cases are
    /// converted via `JSONValue.toAny()`.
    public private(set) var value: Any?

    /// Whether this field is required.
    public private(set) var required: Bool = false

    /// Whether this field is visible (relevant).
    public private(set) var visible: Bool = true

    /// Whether this field is read-only.
    public private(set) var readonly: Bool = false

    // MARK: - Interaction (Swift-side only)

    /// Whether the user has interacted with this field.
    ///
    /// Set to `true` via `touch()`. Never overwritten by bridge patches.
    public private(set) var touched: Bool = false

    // MARK: - Validation (reactive)

    /// All validation results currently targeting this field.
    public private(set) var errors: [ResolvedValidationResult] = []

    /// The message of the first error, or `nil` if there are none.
    public private(set) var firstError: String?

    // MARK: - Options (reactive)

    /// The resolved list of choice options for this field.
    public private(set) var options: [ResolvedOption] = []

    /// Whether options are currently being loaded asynchronously.
    public private(set) var optionsLoading: Bool = false

    /// An error message from the most recent failed options fetch, if any.
    public private(set) var optionsError: String?

    // MARK: - Delegate

    /// Weak back-reference to the engine. `FormspecEngine` will conform to `FieldStateDelegate`.
    public weak var delegate: FieldStateDelegate?

    // MARK: - Init

    public init(
        templatePath: String,
        instancePath: String,
        id: String,
        itemKey: String,
        dataType: String,
        disabledDisplay: DisabledDisplay = .hidden
    ) {
        self.templatePath = templatePath
        self.instancePath = instancePath
        self.id = id
        self.itemKey = itemKey
        self.dataType = dataType
        self.disabledDisplay = disabledDisplay
    }

    // MARK: - Public API

    /// Set the field's value, notifying the engine delegate.
    ///
    /// Pass `nil` to clear the field. The delegate forwards the change to the JS engine.
    public func setValue(_ value: Any?) {
        delegate?.fieldDidSetValue(instancePath, value: value)
    }

    /// Mark this field as touched and notify the engine delegate.
    ///
    /// Once touched, `touched` stays `true` for the lifetime of this `FieldState`.
    public func touch() {
        touched = true
        delegate?.fieldDidTouch(instancePath)
    }

    // MARK: - Internal: Bridge patch application

    /// Apply a partial patch received from the JS engine bridge.
    ///
    /// Only non-`nil` patch fields are written; absent fields leave existing values unchanged.
    /// The `touched` flag is never modified by patches.
    func apply(patch: FieldStatePatch) {
        if let v = patch.label       { label = v }
        if let v = patch.hint        { hint = v }
        if let v = patch.description { description = v }

        if let jsonVal = patch.value  { value = jsonVal.toAny() }

        if let v = patch.required    { required = v }
        if let v = patch.visible     { visible = v }
        if let v = patch.readonly    { readonly = v }

        if let v = patch.errors {
            errors = v
            // Derive firstError from the errors array when errors is patched:
            // an explicit empty array clears firstError; a non-empty array overrides it
            // unless the patch also carries an explicit firstError.
            if v.isEmpty {
                firstError = nil
            } else if patch.firstError == nil {
                firstError = v.first?.message
            }
        }
        if let v = patch.firstError  { firstError = v }

        if let v = patch.options         { options = v }
        if let v = patch.optionsLoading  { optionsLoading = v }
        if let v = patch.optionsError    { optionsError = v }
    }
}

// MARK: - JSONValue → Any? conversion

extension JSONValue {
    /// Convert a `JSONValue` to a native Swift type for storage in `FieldState.value`.
    ///
    /// - `.string` → `String`
    /// - `.number` → `Double`
    /// - `.bool`   → `Bool`
    /// - `.null`   → `nil`
    /// - `.array`  → `[Any?]`
    /// - `.object` → `[String: Any?]`
    func toAny() -> Any? {
        switch self {
        case .string(let s):  return s
        case .number(let n):  return n
        case .bool(let b):    return b
        case .null:           return nil
        case .array(let a):   return a.map { $0.toAny() }
        case .object(let o):  return o.mapValues { $0.toAny() }
        }
    }
}
