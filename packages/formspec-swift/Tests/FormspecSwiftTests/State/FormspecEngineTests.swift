/// @filedesc FormspecEngineTests — unit tests for FormspecEngine event processing using the internal init.

import Testing
@testable import FormspecSwift

// MARK: - Fixtures

private func makeRootLayoutNode() -> LayoutNode {
    LayoutNode(
        id: "root",
        component: "Column",
        category: .layout,
        props: [:],
        style: nil,
        cssClasses: [],
        accessibility: nil,
        children: [],
        bindPath: nil,
        fieldItem: nil,
        presentation: nil,
        labelPosition: nil,
        when: nil,
        whenPrefix: nil,
        fallback: nil,
        repeatGroup: nil,
        repeatPath: nil,
        isRepeatTemplate: nil
    )
}

// MARK: - FormspecEngineTests

@Suite("FormspecEngine")
@MainActor
struct FormspecEngineTests {

    // MARK: - testFieldStateForUnknownPath

    @Test("fieldState returns nil for unknown path")
    func testFieldStateForUnknownPath() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())
        #expect(engine.fieldState(for: "unknownPath") == nil)
    }

    // MARK: - testProcessFieldStateEvents

    @Test("processEvents creates and populates FieldState from fieldStateChanged")
    func testProcessFieldStateEvents() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        let patch = FieldStatePatch(
            label: "First Name",
            hint: "Enter your first name",
            value: .string("Alice"),
            required: true,
            visible: true
        )
        let events: [EngineEvent] = [
            .fieldStateChanged(path: "firstName", changes: patch)
        ]
        engine.processEvents(events)

        let state = engine.fieldState(for: "firstName")
        #expect(state != nil)
        #expect(state?.label == "First Name")
        #expect(state?.hint == "Enter your first name")
        #expect((state?.value as? String) == "Alice")
        #expect(state?.required == true)
        #expect(state?.visible == true)
    }

    @Test("processEvents updates existing FieldState on repeated events")
    func testProcessFieldStateEventsUpdate() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        // Create initial state
        engine.processEvents([
            .fieldStateChanged(path: "age", changes: FieldStatePatch(label: "Age", value: .number(20)))
        ])

        // Update it
        engine.processEvents([
            .fieldStateChanged(path: "age", changes: FieldStatePatch(value: .number(25)))
        ])

        let state = engine.fieldState(for: "age")
        #expect(state != nil)
        // Label preserved from first patch
        #expect(state?.label == "Age")
        // Value updated
        #expect((state?.value as? Double) == 25)
    }

    // MARK: - testProcessFormStateEvents

    @Test("processEvents applies formStateChanged patch to formState")
    func testProcessFormStateEvents() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        let patch = FormStatePatch(
            title: "My Form",
            description: "Test form",
            isValid: false,
            errors: 3,
            warnings: 1,
            infos: 0
        )
        engine.processEvents([.formStateChanged(changes: patch)])

        #expect(engine.formState.title == "My Form")
        #expect(engine.formState.description == "Test form")
        #expect(engine.formState.isValid == false)
        #expect(engine.formState.validationSummary.errors == 3)
        #expect(engine.formState.validationSummary.warnings == 1)
        #expect(engine.formState.validationSummary.infos == 0)
    }

    // MARK: - testPageStateChanged

    @Test("processEvents caches page title and description from pageStateChanged")
    func testPageStateChanged() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        engine.processEvents([
            .pageStateChanged(pageId: "page1", title: "Step 1", description: "Tell us about yourself")
        ])

        #expect(engine.formState.pageTitle("page1") == "Step 1")
        #expect(engine.formState.pageDescription("page1") == "Tell us about yourself")
        // Unknown page returns empty string
        #expect(engine.formState.pageTitle("unknown") == "")
    }

    // MARK: - testRepeatChangedCreatesNewPaths

    @Test("fieldStateChanged events after repeatChanged create findable states")
    func testRepeatChangedCreatesNewPaths() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        // repeatChanged is a no-op (new paths arrive as fieldStateChanged)
        engine.processEvents([
            .repeatChanged(groupName: "contacts", count: 2)
        ])

        // New repeat instance fields arrive as fieldStateChanged events
        engine.processEvents([
            .fieldStateChanged(path: "contacts[0].name", changes: FieldStatePatch(label: "Name", value: .string("Bob"))),
            .fieldStateChanged(path: "contacts[1].name", changes: FieldStatePatch(label: "Name", value: .string("Carol")))
        ])

        let state0 = engine.fieldState(for: "contacts[0].name")
        let state1 = engine.fieldState(for: "contacts[1].name")
        #expect(state0 != nil)
        #expect((state0?.value as? String) == "Bob")
        #expect(state1 != nil)
        #expect((state1?.value as? String) == "Carol")
    }

    // MARK: - testFullEventSequence

    @Test("realistic multi-event sequence simulating form initialization and interaction")
    func testFullEventSequence() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        // 1. Form initializes
        engine.processEvents([
            .engineReady,
            .formStateChanged(changes: FormStatePatch(title: "Contact Form", isValid: true, errors: 0, warnings: 0, infos: 0)),
            .fieldStateChanged(path: "email", changes: FieldStatePatch(label: "Email", required: true, visible: true)),
            .fieldStateChanged(path: "name", changes: FieldStatePatch(label: "Name", required: false, visible: true)),
        ])

        #expect(engine.formState.title == "Contact Form")
        #expect(engine.formState.isValid == true)
        #expect(engine.fieldState(for: "email")?.label == "Email")
        #expect(engine.fieldState(for: "email")?.required == true)
        #expect(engine.fieldState(for: "name")?.label == "Name")

        // 2. User enters invalid email — validation fires
        engine.processEvents([
            .fieldStateChanged(path: "email", changes: FieldStatePatch(
                value: .string("notanemail"),
                errors: [ResolvedValidationResult(
                    path: "email",
                    message: "Must be a valid email",
                    severity: .error,
                    constraintKind: "constraint",
                    code: nil
                )],
                firstError: "Must be a valid email"
            )),
            .formStateChanged(changes: FormStatePatch(isValid: false, errors: 1))
        ])

        let emailState = engine.fieldState(for: "email")
        #expect((emailState?.value as? String) == "notanemail")
        #expect(emailState?.firstError == "Must be a valid email")
        #expect(emailState?.errors.count == 1)
        #expect(engine.formState.isValid == false)
        #expect(engine.formState.validationSummary.errors == 1)

        // 3. User corrects email — clears validation
        engine.processEvents([
            .fieldStateChanged(path: "email", changes: FieldStatePatch(
                value: .string("alice@example.com"),
                errors: [],
                firstError: nil
            )),
            .formStateChanged(changes: FormStatePatch(isValid: true, errors: 0))
        ])

        #expect((engine.fieldState(for: "email")?.value as? String) == "alice@example.com")
        #expect(engine.formState.isValid == true)
        #expect(engine.formState.validationSummary.errors == 0)

        // 4. engineError is logged but does not crash
        engine.processEvents([.engineError(message: "Something went wrong")])
        // No assertion needed — just must not throw/crash
    }

    // MARK: - testFieldStateDelegation

    @Test("FieldState delegate is set to engine — setValue calls fieldDidSetValue")
    func testFieldStateDelegation() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        engine.processEvents([
            .fieldStateChanged(path: "city", changes: FieldStatePatch(label: "City", visible: true))
        ])

        let state = engine.fieldState(for: "city")
        #expect(state != nil)
        #expect(state?.delegate != nil)

        // Calling setValue should not crash (bridge is nil in internal-init engine)
        state?.setValue("Portland")
        state?.touch()
    }

    // MARK: - testMultipleFieldsIndependent

    @Test("multiple field states are tracked independently")
    func testMultipleFieldsIndependent() {
        let engine = FormspecEngine(rootLayoutNode: makeRootLayoutNode())

        engine.processEvents([
            .fieldStateChanged(path: "a", changes: FieldStatePatch(label: "A", value: .number(1))),
            .fieldStateChanged(path: "b", changes: FieldStatePatch(label: "B", value: .number(2))),
            .fieldStateChanged(path: "c", changes: FieldStatePatch(label: "C", value: .number(3))),
        ])

        #expect(engine.fieldState(for: "a")?.label == "A")
        #expect((engine.fieldState(for: "a")?.value as? Double) == 1)
        #expect(engine.fieldState(for: "b")?.label == "B")
        #expect((engine.fieldState(for: "b")?.value as? Double) == 2)
        #expect(engine.fieldState(for: "c")?.label == "C")
        #expect((engine.fieldState(for: "c")?.value as? Double) == 3)
    }
}
