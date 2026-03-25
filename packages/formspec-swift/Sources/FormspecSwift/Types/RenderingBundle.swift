/// @filedesc RenderingBundle and RuntimeContext — everything the engine needs to initialize a form.

import Foundation

/// All documents the formspec engine needs to load and render a form.
///
/// `definition` and `layoutPlan` are required. All other fields are optional
/// and widen the bundle with theming, component overrides, localization, and
/// runtime metadata.
public struct RenderingBundle: Codable, Sendable {
    /// The form definition document.
    public let definition: JSONValue
    /// The resolved layout plan (tree of `LayoutNode`-compatible JSON).
    public let layoutPlan: JSONValue
    /// Optional component document (overrides built-in component defaults).
    public let component: JSONValue?
    /// Optional theme document.
    public let theme: JSONValue?
    /// Optional list of registry documents to load.
    public let registry: [JSONValue]?
    /// Optional locale map (language code → resource object).
    public let locales: [String: JSONValue]?
    /// The locale key to use when none is specified.
    public let defaultLocale: String?
    /// Optional runtime context injected into FEL and validation.
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

/// Ambient runtime metadata injected into the engine at startup.
public struct RuntimeContext: Codable, Sendable {
    /// Arbitrary key-value metadata available to FEL expressions.
    public let meta: [String: JSONValue]?
    /// IANA time-zone identifier (e.g. `"America/New_York"`).
    public let timeZone: String?
    /// Optional deterministic seed for any randomness in FEL functions.
    public let seed: Int?

    public init(
        meta: [String: JSONValue]? = nil,
        timeZone: String? = nil,
        seed: Int? = nil
    ) {
        self.meta = meta
        self.timeZone = timeZone
        self.seed = seed
    }
}
