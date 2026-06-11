import Foundation
import PDFKit
import UIKit

// MARK: - Chat message (used by AI Coach)

struct ChatMessage: Identifiable {
    let id        = UUID()
    let role:      String   // "user" or "assistant"
    let content:   String
    let timestamp  = Date()
}

// MARK: - Parsed assignment (output of syllabus parse)

struct ParsedAssignment: Identifiable {
    let id       = UUID()
    let title:     String
    let dueDate:   Date?
    let notes:     String?
    var isSelected = true
}

// MARK: - Errors

enum AnthropicError: LocalizedError {
    case noAPIKey
    case networkError(String)
    case apiError(Int, String)
    case parseError(String)

    var errorDescription: String? {
        switch self {
        case .noAPIKey:
            return "No Anthropic API key set. Add it in Settings → Integrations."
        case .networkError(let msg):
            return "Network error: \(msg)"
        case .apiError(let code, let msg):
            return "API error \(code): \(msg)"
        case .parseError(let msg):
            return "Could not parse response: \(msg)"
        }
    }
}

// MARK: - Service

final class AnthropicService {

    static let shared = AnthropicService()
    private init() {}

    // ⚠️ Paste your Anthropic key here. Never commit this to a public repo.
    private static let defaultKey = "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"

    // Update this string to switch Claude models globally.
    private let model    = "claude-sonnet-4"
    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    // MARK: Parse syllabus

    /// Sends `imageData` (JPEG) to Claude and returns structured assignments.
    func parseSyllabus(imageData: Data, mimeType: String = "image/jpeg") async throws -> [ParsedAssignment] {
        let key = UserDefaults.standard.string(forKey: "lifeos.anthropicKey") ?? Self.defaultKey
        guard !key.isEmpty else { throw AnthropicError.noAPIKey }

        let currentYear = Calendar.current.component(.year, from: Date())
        let body: [String: Any] = [
            "model": model,
            "max_tokens": 2048,
            "messages": [
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "image",
                            "source": [
                                "type":       "base64",
                                "media_type": mimeType,
                                "data":       imageData.base64EncodedString()
                            ]
                        ],
                        [
                            "type": "text",
                            "text": prompt(year: currentYear)
                        ]
                    ]
                ]
            ]
        ]

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue(key,            forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01",   forHTTPHeaderField: "anthropic-version")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw AnthropicError.networkError("No HTTP response received.")
        }
        guard http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AnthropicError.apiError(http.statusCode, msg)
        }

        guard
            let json    = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let block   = content.first,
            let text    = block["text"] as? String
        else {
            throw AnthropicError.parseError("Unexpected API response format.")
        }

        return try decodeAssignments(from: text)
    }

    // MARK: Chat (AI Coach)

    /// Sends a multi-turn conversation to Claude and returns the assistant's reply.
    func chat(messages: [ChatMessage], systemPrompt: String) async throws -> String {
        let key = UserDefaults.standard.string(forKey: "lifeos.anthropicKey") ?? Self.defaultKey
        guard !key.isEmpty else { throw AnthropicError.noAPIKey }

        let apiMessages = messages.map { ["role": $0.role, "content": $0.content] }
        let body: [String: Any] = [
            "model":      model,
            "max_tokens": 1024,
            "system":     systemPrompt,
            "messages":   apiMessages
        ]

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue(key,                forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01",       forHTTPHeaderField: "anthropic-version")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw AnthropicError.networkError("No HTTP response received.")
        }
        guard http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AnthropicError.apiError(http.statusCode, msg)
        }

        guard
            let json    = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let block   = content.first,
            let text    = block["text"] as? String
        else {
            throw AnthropicError.parseError("Unexpected API response format.")
        }
        return text
    }

    // MARK: Single-turn completion

    /// Convenience for one-shot prompts that don't need conversation history.
    func complete(prompt: String, systemPrompt: String = "", maxTokens: Int = 512) async throws -> String {
        let key = UserDefaults.standard.string(forKey: "lifeos.anthropicKey") ?? Self.defaultKey
        guard !key.isEmpty else { throw AnthropicError.noAPIKey }

        var body: [String: Any] = [
            "model":      model,
            "max_tokens": maxTokens,
            "messages":   [["role": "user", "content": prompt]]
        ]
        if !systemPrompt.isEmpty { body["system"] = systemPrompt }

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue(key,                forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01",       forHTTPHeaderField: "anthropic-version")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw AnthropicError.networkError("No HTTP response received.")
        }
        guard http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AnthropicError.apiError(http.statusCode, msg)
        }
        guard
            let json    = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let block   = content.first,
            let text    = block["text"] as? String
        else {
            throw AnthropicError.parseError("Unexpected API response format.")
        }
        return text
    }

    // MARK: PDF → JPEG

    /// Renders the first `maxPages` pages of a PDF into a single stacked JPEG
    /// suitable for sending to the vision API.
    static func renderPDF(_ data: Data, maxPages: Int = 2) -> (Data, String)? {
        guard let doc = PDFDocument(data: data), doc.pageCount > 0 else { return nil }
        let count = min(doc.pageCount, maxPages)
        let scale: CGFloat = 1.5

        // Render each page to its own UIImage
        var images: [UIImage] = []
        for i in 0..<count {
            guard let page = doc.page(at: i) else { continue }
            let bounds = page.bounds(for: .mediaBox)
            let size   = CGSize(width: bounds.width * scale, height: bounds.height * scale)
            let renderer = UIGraphicsImageRenderer(size: size)
            let img = renderer.image { ctx in
                // White background
                UIColor.white.setFill()
                ctx.fill(CGRect(origin: .zero, size: size))
                // Flip from PDF coordinate system (bottom-left) to UIKit (top-left)
                ctx.cgContext.translateBy(x: 0, y: bounds.height * scale)
                ctx.cgContext.scaleBy(x: scale, y: -scale)
                page.draw(with: .mediaBox, to: ctx.cgContext)
            }
            images.append(img)
        }
        guard !images.isEmpty else { return nil }

        // Stack pages vertically into one image
        let totalHeight = images.reduce(0) { $0 + $1.size.height }
        let width       = images.first!.size.width
        let stacked = UIGraphicsImageRenderer(size: CGSize(width: width, height: totalHeight)).image { _ in
            var y: CGFloat = 0
            for img in images {
                img.draw(at: CGPoint(x: 0, y: y))
                y += img.size.height
            }
        }

        guard let jpeg = stacked.jpegData(compressionQuality: 0.82) else { return nil }
        return (jpeg, "image/jpeg")
    }

    // MARK: Helpers

    private func prompt(year: Int) -> String {
        """
        Parse this syllabus image and extract every assignment, exam, quiz, project, \
        lab, paper, and graded deadline.

        Return ONLY a raw JSON array — no markdown fences, no explanation, nothing else. \
        Each element:
        {
          "title":   "Assignment name (under 60 chars)",
          "dueDate": "YYYY-MM-DD" or null,
          "notes":   "Brief detail (under 120 chars)" or null
        }

        Rules:
        • Use year \(year) for spring/summer/fall semester dates. If dates clearly \
          fall in a new calendar year (e.g. Jan–May listed after fall dates), use \(year + 1).
        • Include every graded item, even if the due date is missing — set dueDate to null.
        • If there are truly no assignments, return [].
        • Keep JSON strictly valid; use null not empty string for missing values.
        """
    }

    private func decodeAssignments(from text: String) throws -> [ParsedAssignment] {
        // Trim anything outside the JSON array in case the model adds stray text
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let start = s.firstIndex(of: "["), let end = s.lastIndex(of: "]") {
            s = String(s[start...end])
        }

        guard
            let raw   = s.data(using: .utf8),
            let array = try? JSONSerialization.jsonObject(with: raw) as? [[String: Any]]
        else {
            throw AnthropicError.parseError("Could not decode assignment list from response.")
        }

        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.timeZone   = .current

        return array.compactMap { item -> ParsedAssignment? in
            guard let title = item["title"] as? String, !title.isEmpty else { return nil }
            let dueDate = (item["dueDate"] as? String).flatMap { fmt.date(from: $0) }
            let notes   = item["notes"] as? String
            return ParsedAssignment(title: title, dueDate: dueDate, notes: notes)
        }
    }
}
