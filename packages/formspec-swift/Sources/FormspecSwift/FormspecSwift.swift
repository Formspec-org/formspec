/// FormspecSwift — Native SwiftUI form renderer powered by formspec-engine.
///
/// Uses a hidden WKWebView bridge to run the formspec-engine + WASM runtime,
/// exposing reactive @Observable state that SwiftUI views bind to directly.
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
///
/// ## Hooks Only (full control)
///
/// ```swift
/// if let name = engine.fieldState(for: "contactInfo.fullName") {
///     TextField("", text: Binding(
///         get: { name.value as? String ?? "" },
///         set: { name.setValue($0) }
///     ))
/// }
/// ```
public enum FormspecSwift {
    public static let version = "0.1.0"
}
