/// @filedesc FormState — @Observable class tracking overall form-level reactive state for SwiftUI binding.

import Foundation
import Observation

/// Reactive state for the overall form, designed for SwiftUI binding via `@Observable`.
///
/// Updated by calling `apply(patch:)` from the engine bridge when form-level state changes.
/// Page titles and descriptions are cached via `setPageTitle(_:title:)` /
/// `setPageDescription(_:description:)` in response to `pageStateChanged` events.
@Observable
public final class FormState: @unchecked Sendable {

    // MARK: - Form-level state (reactive)

    /// The form's display title.
    public private(set) var title: String = ""

    /// The form's description text.
    public private(set) var description: String = ""

    /// Whether the form currently has no validation errors.
    public private(set) var isValid: Bool = true

    /// Aggregated validation result counts by severity.
    public private(set) var validationSummary: ValidationSummary = ValidationSummary(errors: 0, warnings: 0, infos: 0)

    // MARK: - Page cache (reactive via @Observable)

    private var pageTitles: [String: String] = [:]
    private var pageDescriptions: [String: String] = [:]

    // MARK: - Init

    public init() {}

    // MARK: - Page accessors

    /// The title for the given wizard page, or `""` if not yet received.
    public func pageTitle(_ pageId: String) -> String {
        pageTitles[pageId] ?? ""
    }

    /// The description for the given wizard page, or `""` if not yet received.
    public func pageDescription(_ pageId: String) -> String {
        pageDescriptions[pageId] ?? ""
    }

    // MARK: - Internal: Page cache mutation

    func setPageTitle(_ pageId: String, title: String) {
        pageTitles[pageId] = title
    }

    func setPageDescription(_ pageId: String, description: String) {
        pageDescriptions[pageId] = description
    }

    // MARK: - Internal: Bridge patch application

    /// Apply a partial patch received from the JS engine bridge.
    ///
    /// Only non-`nil` patch fields are written. `validationSummary` components
    /// (`errors`, `warnings`, `infos`) are updated individually — a patch that
    /// specifies only `errors` leaves `warnings` and `infos` unchanged.
    func apply(patch: FormStatePatch) {
        if let v = patch.title       { title = v }
        if let v = patch.description { description = v }
        if let v = patch.isValid     { isValid = v }

        // Update validationSummary components individually so a partial patch
        // (e.g. only errors) does not reset the unchanged counters.
        let currentErrors   = validationSummary.errors
        let currentWarnings = validationSummary.warnings
        let currentInfos    = validationSummary.infos

        let newErrors   = patch.errors   ?? currentErrors
        let newWarnings = patch.warnings ?? currentWarnings
        let newInfos    = patch.infos    ?? currentInfos

        if newErrors != currentErrors || newWarnings != currentWarnings || newInfos != currentInfos {
            validationSummary = ValidationSummary(
                errors: newErrors,
                warnings: newWarnings,
                infos: newInfos
            )
        }
    }
}
