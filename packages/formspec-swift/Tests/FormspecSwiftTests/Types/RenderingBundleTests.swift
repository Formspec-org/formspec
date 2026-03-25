import XCTest
@testable import FormspecSwift

final class RenderingBundleTests: XCTestCase {

    // MARK: - Minimal bundle (required fields only)

    func testDecodeMinimalBundle() throws {
        let json = """
        {
            "definition": {"$schema": "https://formspec.org/schemas/definition.json"},
            "layoutPlan": {"nodes": []}
        }
        """.data(using: .utf8)!

        let bundle = try JSONDecoder().decode(RenderingBundle.self, from: json)

        // Required fields
        XCTAssertNotNil(bundle.definition.objectValue)
        XCTAssertNotNil(bundle.layoutPlan.objectValue)

        // All optionals must be absent
        XCTAssertNil(bundle.component)
        XCTAssertNil(bundle.theme)
        XCTAssertNil(bundle.registry)
        XCTAssertNil(bundle.locales)
        XCTAssertNil(bundle.defaultLocale)
        XCTAssertNil(bundle.runtimeContext)
    }

    // MARK: - Full bundle (all optional fields)

    func testDecodeFullBundle() throws {
        let json = """
        {
            "definition": {"type": "object"},
            "layoutPlan": {"nodes": []},
            "component": {"version": "1.0"},
            "theme": {"tokens": {}},
            "registry": [{"id": "ext1"}],
            "locales": {
                "en": {"greeting": "Hello"},
                "fr": {"greeting": "Bonjour"}
            },
            "defaultLocale": "en",
            "runtimeContext": {
                "meta": {"userId": "u1"},
                "timeZone": "America/New_York",
                "seed": 42
            }
        }
        """.data(using: .utf8)!

        let bundle = try JSONDecoder().decode(RenderingBundle.self, from: json)

        XCTAssertNotNil(bundle.component)
        XCTAssertNotNil(bundle.theme)
        XCTAssertEqual(bundle.registry?.count, 1)
        XCTAssertEqual(bundle.locales?.count, 2)
        XCTAssertEqual(bundle.defaultLocale, "en")

        let ctx = try XCTUnwrap(bundle.runtimeContext)
        XCTAssertEqual(ctx.timeZone, "America/New_York")
        XCTAssertEqual(ctx.seed, 42)
        XCTAssertEqual(ctx.meta?["userId"], .string("u1"))
    }

    // MARK: - Encoding round-trip

    func testEncodingRoundTripMinimal() throws {
        let original = RenderingBundle(
            definition: .object(["key": .string("value")]),
            layoutPlan: .object(["nodes": .array([])])
        )
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(RenderingBundle.self, from: data)

        XCTAssertEqual(decoded.definition, original.definition)
        XCTAssertEqual(decoded.layoutPlan, original.layoutPlan)
        XCTAssertNil(decoded.component)
        XCTAssertNil(decoded.runtimeContext)
    }

    func testEncodingRoundTripFull() throws {
        let ctx = RuntimeContext(
            meta: ["env": .string("test")],
            timeZone: "UTC",
            seed: 99
        )
        let original = RenderingBundle(
            definition: .object(["$schema": .string("https://example.com")]),
            layoutPlan: .array([]),
            component: .object(["v": .number(2)]),
            theme: .object(["tokens": .object([:])]),
            registry: [.object(["id": .string("r1")])],
            locales: ["en": .object(["ok": .bool(true)])],
            defaultLocale: "en",
            runtimeContext: ctx
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(RenderingBundle.self, from: data)

        XCTAssertEqual(decoded.definition, original.definition)
        XCTAssertEqual(decoded.layoutPlan, original.layoutPlan)
        XCTAssertEqual(decoded.component, original.component)
        XCTAssertEqual(decoded.theme, original.theme)
        XCTAssertEqual(decoded.registry?.count, 1)
        XCTAssertEqual(decoded.defaultLocale, "en")
        XCTAssertEqual(decoded.runtimeContext?.timeZone, "UTC")
        XCTAssertEqual(decoded.runtimeContext?.seed, 99)
    }

    // MARK: - RuntimeContext

    func testRuntimeContextDefaultsToNil() throws {
        let ctx = RuntimeContext()
        XCTAssertNil(ctx.meta)
        XCTAssertNil(ctx.timeZone)
        XCTAssertNil(ctx.seed)
    }

    func testRuntimeContextRoundTrip() throws {
        let original = RuntimeContext(meta: ["key": .bool(false)], timeZone: "Asia/Tokyo", seed: 7)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(RuntimeContext.self, from: data)

        XCTAssertEqual(decoded.timeZone, "Asia/Tokyo")
        XCTAssertEqual(decoded.seed, 7)
        XCTAssertEqual(decoded.meta?["key"], .bool(false))
    }
}
