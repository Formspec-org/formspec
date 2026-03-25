/// @filedesc Tests for FormState @Observable class — initial state, patch application, page caching.

import Testing
@testable import FormspecSwift

@Suite("FormState")
struct FormStateTests {

    // MARK: - Initial State

    @Test("initial state has correct defaults")
    func testInitialState() {
        let state = FormState()

        #expect(state.title == "")
        #expect(state.description == "")
        #expect(state.isValid == true)
        #expect(state.validationSummary == ValidationSummary(errors: 0, warnings: 0, infos: 0))
    }

    // MARK: - Apply Full Patch

    @Test("apply full patch updates all fields")
    func testApplyPatch() {
        let state = FormState()

        let patch = FormStatePatch(
            title: "My Form",
            description: "A test form",
            isValid: false,
            errors: 3,
            warnings: 1,
            infos: 2
        )
        state.apply(patch: patch)

        #expect(state.title == "My Form")
        #expect(state.description == "A test form")
        #expect(state.isValid == false)
        #expect(state.validationSummary == ValidationSummary(errors: 3, warnings: 1, infos: 2))
    }

    // MARK: - Apply Partial Patch

    @Test("apply partial patch only updates non-nil fields")
    func testApplyPartialPatch() {
        let state = FormState()

        // First apply a full patch to set baseline
        let baseline = FormStatePatch(
            title: "Original Title",
            description: "Original description",
            isValid: false,
            errors: 2,
            warnings: 0,
            infos: 0
        )
        state.apply(patch: baseline)

        // Now apply partial — only title changes
        let partialPatch = FormStatePatch(title: "New Title")
        state.apply(patch: partialPatch)

        // Updated
        #expect(state.title == "New Title")

        // Unchanged
        #expect(state.description == "Original description")
        #expect(state.isValid == false)
        #expect(state.validationSummary.errors == 2)
        #expect(state.validationSummary.warnings == 0)
    }

    @Test("apply partial patch with only isValid leaves summary unchanged")
    func testApplyPartialPatchValidOnly() {
        let state = FormState()

        let baseline = FormStatePatch(
            title: "Form",
            isValid: false,
            errors: 5,
            warnings: 2,
            infos: 1
        )
        state.apply(patch: baseline)

        // Patch only the isValid flag
        let patch = FormStatePatch(isValid: true)
        state.apply(patch: patch)

        #expect(state.isValid == true)
        // Summary counts stay because no errors/warnings/infos in patch
        #expect(state.validationSummary.errors == 5)
        #expect(state.validationSummary.warnings == 2)
        #expect(state.validationSummary.infos == 1)
    }

    @Test("validation summary components update independently")
    func testValidationSummaryPartialUpdate() {
        let state = FormState()

        let baseline = FormStatePatch(errors: 3, warnings: 2, infos: 1)
        state.apply(patch: baseline)

        // Only errors changes
        let patch = FormStatePatch(errors: 0)
        state.apply(patch: patch)

        #expect(state.validationSummary.errors == 0)
        #expect(state.validationSummary.warnings == 2)
        #expect(state.validationSummary.infos == 1)
    }

    // MARK: - Page Title Caching

    @Test("setPageTitle stores and retrieves title for a page")
    func testPageTitleCaching() {
        let state = FormState()

        state.setPageTitle("page-1", title: "Introduction")
        state.setPageTitle("page-2", title: "Details")

        #expect(state.pageTitle("page-1") == "Introduction")
        #expect(state.pageTitle("page-2") == "Details")
    }

    @Test("setPageDescription stores and retrieves description for a page")
    func testPageDescriptionCaching() {
        let state = FormState()

        state.setPageDescription("page-1", description: "Tell us about yourself")
        state.setPageDescription("page-2", description: "Provide your details")

        #expect(state.pageDescription("page-1") == "Tell us about yourself")
        #expect(state.pageDescription("page-2") == "Provide your details")
    }

    @Test("pageTitle returns empty string for unknown pageId")
    func testPageTitleUnknown() {
        let state = FormState()
        #expect(state.pageTitle("nonexistent") == "")
    }

    @Test("pageDescription returns empty string for unknown pageId")
    func testPageDescriptionUnknown() {
        let state = FormState()
        #expect(state.pageDescription("nonexistent") == "")
    }

    @Test("setPageTitle overwrites existing title")
    func testPageTitleOverwrite() {
        let state = FormState()
        state.setPageTitle("page-1", title: "Old Title")
        state.setPageTitle("page-1", title: "New Title")
        #expect(state.pageTitle("page-1") == "New Title")
    }

    @Test("multiple pages are stored independently")
    func testMultiplePagesCached() {
        let state = FormState()
        let pages = ["intro", "personal", "employment", "review"]

        for (i, pageId) in pages.enumerated() {
            state.setPageTitle(pageId, title: "Page \(i + 1)")
            state.setPageDescription(pageId, description: "Description \(i + 1)")
        }

        for (i, pageId) in pages.enumerated() {
            #expect(state.pageTitle(pageId) == "Page \(i + 1)")
            #expect(state.pageDescription(pageId) == "Description \(i + 1)")
        }
    }
}
