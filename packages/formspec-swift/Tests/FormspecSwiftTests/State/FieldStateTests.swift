/// @filedesc Tests for FieldState @Observable class — initial state, patch application, touch, delegation.

import Testing
@testable import FormspecSwift

@Suite("FieldState")
struct FieldStateTests {

    // MARK: - Helpers

    func makeFieldState(
        templatePath: String = "name",
        instancePath: String = "name",
        id: String = "field-1",
        itemKey: String = "name",
        dataType: String = "text",
        disabledDisplay: DisabledDisplay = .hidden
    ) -> FieldState {
        FieldState(
            templatePath: templatePath,
            instancePath: instancePath,
            id: id,
            itemKey: itemKey,
            dataType: dataType,
            disabledDisplay: disabledDisplay
        )
    }

    // MARK: - Initial State

    @Test("initial state has correct defaults")
    func testInitialState() {
        let state = makeFieldState()

        // Identity
        #expect(state.templatePath == "name")
        #expect(state.instancePath == "name")
        #expect(state.id == "field-1")
        #expect(state.itemKey == "name")
        #expect(state.dataType == "text")
        #expect(state.disabledDisplay == .hidden)

        // Presentation
        #expect(state.label == "")
        #expect(state.hint == nil)
        #expect(state.description == nil)

        // State
        #expect(state.value == nil)
        #expect(state.required == false)
        #expect(state.visible == true)
        #expect(state.readonly == false)

        // Interaction — Swift-side only
        #expect(state.touched == false)

        // Validation
        #expect(state.errors.isEmpty)
        #expect(state.firstError == nil)

        // Options
        #expect(state.options.isEmpty)
        #expect(state.optionsLoading == false)
        #expect(state.optionsError == nil)
    }

    // MARK: - Apply Full Patch

    @Test("apply full patch updates all fields")
    func testApplyPatch() {
        let state = makeFieldState()

        let errors = [
            ResolvedValidationResult(
                path: "name",
                message: "Required",
                severity: .error,
                constraintKind: "required",
                code: "REQUIRED"
            )
        ]
        let options = [
            ResolvedOption(value: .string("a"), label: "Option A"),
            ResolvedOption(value: .string("b"), label: "Option B")
        ]

        let patch = FieldStatePatch(
            label: "Full Name",
            hint: "Enter your full name",
            description: "Your legal name",
            value: .string("Alice"),
            required: true,
            visible: false,
            readonly: true,
            errors: errors,
            firstError: "Required",
            options: options,
            optionsLoading: true,
            optionsError: "Failed to load"
        )
        state.apply(patch: patch)

        #expect(state.label == "Full Name")
        #expect(state.hint == "Enter your full name")
        #expect(state.description == "Your legal name")
        #expect((state.value as? String) == "Alice")
        #expect(state.required == true)
        #expect(state.visible == false)
        #expect(state.readonly == true)
        #expect(state.errors == errors)
        #expect(state.firstError == "Required")
        #expect(state.options == options)
        #expect(state.optionsLoading == true)
        #expect(state.optionsError == "Failed to load")

        // touched is never set by patches
        #expect(state.touched == false)
    }

    // MARK: - Apply Partial Patch

    @Test("apply partial patch only updates non-nil fields")
    func testApplyPartialPatch() {
        let state = makeFieldState()

        // First, set some initial state
        let setupPatch = FieldStatePatch(
            label: "Name",
            required: true,
            visible: true
        )
        state.apply(patch: setupPatch)

        // Now apply a partial patch — only label and visible change
        let partialPatch = FieldStatePatch(
            label: "Full Name",
            visible: false
        )
        state.apply(patch: partialPatch)

        // Updated fields
        #expect(state.label == "Full Name")
        #expect(state.visible == false)

        // Unchanged fields retain their prior values
        #expect(state.required == true)
        #expect(state.hint == nil)
        #expect(state.description == nil)
        #expect(state.value == nil)
        #expect(state.readonly == false)
        #expect(state.errors.isEmpty)
        #expect(state.firstError == nil)
    }

    // MARK: - Touch

    @Test("touch() sets touched to true")
    func testTouch() {
        let state = makeFieldState()
        #expect(state.touched == false)
        state.touch()
        #expect(state.touched == true)
    }

    @Test("touch() is idempotent")
    func testTouchIdempotent() {
        let state = makeFieldState()
        state.touch()
        state.touch()
        #expect(state.touched == true)
    }

    // MARK: - touch() does not affect other fields

    @Test("touch() does not change label or other state")
    func testTouchDoesNotAffectOtherFields() {
        let state = makeFieldState()
        let setupPatch = FieldStatePatch(label: "Name", required: true)
        state.apply(patch: setupPatch)

        state.touch()

        #expect(state.label == "Name")
        #expect(state.required == true)
    }

    // MARK: - Value Conversion

    @Test("number value patch stores Double")
    func testValueConversionNumber() {
        let state = makeFieldState()
        let patch = FieldStatePatch(value: .number(42.5))
        state.apply(patch: patch)
        #expect((state.value as? Double) == 42.5)
    }

    @Test("bool value patch stores Bool")
    func testValueConversionBool() {
        let state = makeFieldState()
        let patch = FieldStatePatch(value: .bool(true))
        state.apply(patch: patch)
        #expect((state.value as? Bool) == true)
    }

    @Test("string value patch stores String")
    func testValueConversionString() {
        let state = makeFieldState()
        let patch = FieldStatePatch(value: .string("hello"))
        state.apply(patch: patch)
        #expect((state.value as? String) == "hello")
    }

    @Test("null value patch stores nil")
    func testValueConversionNull() {
        let state = makeFieldState()
        // First set a value
        state.apply(patch: FieldStatePatch(value: .string("hello")))
        #expect(state.value != nil)

        // Then set to null
        state.apply(patch: FieldStatePatch(value: .null))
        #expect(state.value == nil)
    }

    @Test("array value patch stores [Any?]")
    func testValueConversionArray() {
        let state = makeFieldState()
        let patch = FieldStatePatch(value: .array([.string("a"), .number(1.0)]))
        state.apply(patch: patch)
        let arr = state.value as? [Any?]
        #expect(arr != nil)
        #expect(arr?.count == 2)
        #expect((arr?[0] as? String) == "a")
        #expect((arr?[1] as? Double) == 1.0)
    }

    @Test("object value patch stores [String: Any?]")
    func testValueConversionObject() {
        let state = makeFieldState()
        let patch = FieldStatePatch(value: .object(["key": .string("val")]))
        state.apply(patch: patch)
        // Cast to [String: Any] — the stored dict uses Any? but the keys are String
        let obj = state.value as? [String: Any]
        #expect(obj != nil)
        #expect((obj?["key"] as? String) == "val")
    }

    // MARK: - Delegation

    @Test("setValue delegates to FieldStateDelegate")
    func testSetValueDelegates() {
        let state = makeFieldState()
        let spy = DelegateSpy()
        state.delegate = spy

        state.setValue("hello")

        #expect(spy.setValueCalls.count == 1)
        #expect(spy.setValueCalls[0].path == "name")
        #expect((spy.setValueCalls[0].value as? String) == "hello")
    }

    @Test("touch() delegates touchField to FieldStateDelegate")
    func testTouchDelegates() {
        let state = makeFieldState(instancePath: "address.city")
        let spy = DelegateSpy()
        state.delegate = spy

        state.touch()

        #expect(spy.touchCalls == ["address.city"])
    }

    @Test("setValue with nil delegates nil to FieldStateDelegate")
    func testSetValueNilDelegates() {
        let state = makeFieldState()
        let spy = DelegateSpy()
        state.delegate = spy

        state.setValue(nil)

        #expect(spy.setValueCalls.count == 1)
        #expect(spy.setValueCalls[0].value == nil)
    }
}

// MARK: - Test helpers

/// A simple spy that records FieldStateDelegate calls.
final class DelegateSpy: FieldStateDelegate {
    struct SetValueCall {
        let path: String
        let value: Any?
    }

    var setValueCalls: [SetValueCall] = []
    var touchCalls: [String] = []

    func fieldDidSetValue(_ path: String, value: Any?) {
        setValueCalls.append(SetValueCall(path: path, value: value))
    }

    func fieldDidTouch(_ path: String) {
        touchCalls.append(path)
    }
}
