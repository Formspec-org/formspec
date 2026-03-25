/// @filedesc WebViewEngineTests — integration tests for the hidden WKWebView bridge.

import XCTest
@testable import FormspecSwift

// NOTE: These tests exercise WKWebView which requires a running macOS/iOS runtime.
// They use XCTestExpectation + async/await and are marked as requiring main actor.

@MainActor
final class WebViewEngineTests: XCTestCase {

    // MARK: - testSendCommandBeforeLoad

    func testSendCommandBeforeLoad() async {
        let engine = WebViewEngine()
        do {
            try await engine.send(.getResponse)
            XCTFail("Expected error when sending before load")
        } catch {
            // Expected: bridge is not loaded
            XCTAssertFalse(engine.isLoaded)
        }
    }

    // MARK: - testLoadBridgeHTML

    func testLoadBridgeHTML() async throws {
        let engine = WebViewEngine()
        XCTAssertFalse(engine.isLoaded)
        try await engine.loadBridge()
        XCTAssertTrue(engine.isLoaded)
        engine.dispose()
    }

    // MARK: - testDispose

    func testDispose() async throws {
        let engine = WebViewEngine()
        try await engine.loadBridge()
        XCTAssertTrue(engine.isLoaded)
        engine.dispose()
        XCTAssertFalse(engine.isLoaded)
    }
}
