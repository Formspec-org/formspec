/// @filedesc WebViewEngine — hidden WKWebView that hosts the formspec JS engine bridge.

import Foundation
import WebKit

// MARK: - WebViewEngineError

/// Errors thrown by `WebViewEngine`.
enum WebViewEngineError: Error, LocalizedError {
    case notLoaded
    case loadFailed(String)
    case htmlNotFound

    var errorDescription: String? {
        switch self {
        case .notLoaded:
            return "WebViewEngine: bridge is not loaded — call loadBridge() first"
        case .loadFailed(let msg):
            return "WebViewEngine: bridge load failed — \(msg)"
        case .htmlNotFound:
            return "WebViewEngine: formspec-engine.html not found in bundle"
        }
    }
}

// MARK: - WebViewEngine

/// Manages a hidden `WKWebView` that runs the formspec JS engine.
///
/// The WebView loads `formspec-engine.html` from the module bundle, which in turn
/// sets up the JS engine and registers a `window.formspecCommand(jsonString)` entry
/// point for Swift → JS communication, and posts messages via
/// `window.webkit.messageHandlers.formspec.postMessage(jsonString)` for JS → Swift.
@MainActor
final class WebViewEngine: NSObject {

    // MARK: - State

    private var webView: WKWebView?
    private var eventHandler: (([EngineEvent]) -> Void)?
    private var loadContinuation: CheckedContinuation<Void, Error>?

    /// Whether the bridge HTML has been loaded and the WebView is ready.
    private(set) var isLoaded = false

    // MARK: - Public API

    /// Register a handler that receives batches of `EngineEvent` values from the JS engine.
    func onEvents(_ handler: @escaping ([EngineEvent]) -> Void) {
        self.eventHandler = handler
    }

    /// Load `formspec-engine.html` into a hidden `WKWebView`.
    ///
    /// Creates the WebView on first call, registers the `formspec` message handler,
    /// and waits for navigation to finish before returning.
    /// Throws if the HTML resource is missing or the page fails to load.
    func loadBridge() async throws {
        guard let htmlURL = Bundle.module.url(forResource: "formspec-engine", withExtension: "html") else {
            throw WebViewEngineError.htmlNotFound
        }

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "formspec")

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        self.webView = wv

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.loadContinuation = continuation
            wv.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }

        isLoaded = true
    }

    /// Send an `EngineCommand` to the JS engine.
    ///
    /// The command is JSON-encoded and forwarded via `window.formspecCommand(jsonString)`.
    /// Throws `WebViewEngineError.notLoaded` if the bridge has not been loaded yet.
    func send(_ command: EngineCommand) async throws {
        guard let wv = webView, isLoaded else {
            throw WebViewEngineError.notLoaded
        }

        let data = try JSONEncoder().encode(command)
        let jsonString = String(data: data, encoding: .utf8) ?? "{}"

        // Escape the string for safe insertion into a JS single-quoted string literal.
        let escaped = jsonString
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        let js = "window.formspecCommand('\(escaped)')"
        try await wv.evaluateJavaScript(js)
    }

    /// Tear down the `WKWebView` and reset state.
    func dispose() {
        webView?.navigationDelegate = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "formspec")
        webView?.stopLoading()
        webView = nil
        isLoaded = false

        // Resume any pending load continuation with an error so callers aren't stuck.
        if let cont = loadContinuation {
            cont.resume(throwing: WebViewEngineError.loadFailed("disposed before load completed"))
            loadContinuation = nil
        }
    }
}

// MARK: - WKScriptMessageHandler

extension WebViewEngine: WKScriptMessageHandler {
    /// Receives JSON-stringified event batches from the JS engine.
    nonisolated func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let jsonString = message.body as? String,
              let data = jsonString.data(using: .utf8) else {
            return
        }

        let events: [EngineEvent]
        do {
            events = try JSONDecoder().decode([EngineEvent].self, from: data)
        } catch {
            // Try decoding as a single event wrapped in an array.
            if let single = try? JSONDecoder().decode(EngineEvent.self, from: data) {
                events = [single]
            } else {
                return
            }
        }

        // Dispatch to the event handler on the main actor.
        Task { @MainActor in
            self.eventHandler?(events)
        }
    }
}

// MARK: - WKNavigationDelegate

extension WebViewEngine: WKNavigationDelegate {
    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            self.loadContinuation?.resume()
            self.loadContinuation = nil
        }
    }

    nonisolated func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        Task { @MainActor in
            self.loadContinuation?.resume(throwing: WebViewEngineError.loadFailed(error.localizedDescription))
            self.loadContinuation = nil
        }
    }

    nonisolated func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        Task { @MainActor in
            self.loadContinuation?.resume(throwing: WebViewEngineError.loadFailed(error.localizedDescription))
            self.loadContinuation = nil
        }
    }

    nonisolated func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Task { @MainActor in
            self.isLoaded = false
            // Resume any pending load continuation with failure.
            self.loadContinuation?.resume(throwing: WebViewEngineError.loadFailed("WebContent process terminated"))
            self.loadContinuation = nil
        }
    }
}
