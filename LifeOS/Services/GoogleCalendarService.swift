import Foundation
import AuthenticationServices
import UIKit

// MARK: - Errors

enum GCalError: LocalizedError {
    case notConnected
    case authCancelled
    case authFailed(String)
    case apiError(Int, String)
    case noCalendar

    var errorDescription: String? {
        switch self {
        case .notConnected:      return "Not connected to Google Calendar."
        case .authCancelled:     return "Sign-in was cancelled."
        case .authFailed(let m): return "Auth failed: \(m)"
        case .apiError(let c, let m): return "Google API error \(c): \(m)"
        case .noCalendar:        return "Could not find or create the LifeOS calendar."
        }
    }
}

// MARK: - Service

// ─────────────────────────────────────────────────────────────────────────────
// SETUP (do this once — takes ~5 min):
//
//  1. Go to console.cloud.google.com → New project → name it "LifeOS"
//  2. APIs & Services → Library → search "Google Calendar API" → Enable
//  3. APIs & Services → Credentials → + Create Credentials → OAuth client ID
//  4. Application type: iOS  ← important, NOT Web application
//  5. Bundle ID: com.daviddelgado.LifeOS
//  6. Click Create → copy just the Client ID (no secret needed for iOS type)
//  7. Paste it below. The redirect scheme is the client ID reversed:
//       e.g. client ID  →  123456-abc.apps.googleusercontent.com
//            scheme     →  com.googleusercontent.apps.123456-abc
// ─────────────────────────────────────────────────────────────────────────────

@Observable
final class GoogleCalendarService: NSObject {

    static let shared = GoogleCalendarService()

    private static let clientID       = "468547833178-un6gmi9r3coa4kp3o58rulc6kuet237c.apps.googleusercontent.com"
    private static let redirectScheme = "com.googleusercontent.apps.468547833178-un6gmi9r3coa4kp3o58rulc6kuet237c"

    private static var redirectURI: String { "\(redirectScheme):/" }
    private static let scope = "https://www.googleapis.com/auth/calendar"

    // Google API URLs
    private let authBase  = "https://accounts.google.com/o/oauth2/v2/auth"
    private let tokenURL  = URL(string: "https://oauth2.googleapis.com/token")!
    private let calBase   = "https://www.googleapis.com/calendar/v3"

    // MARK: Observable state (views read these directly)

    private(set) var isConnected = false
    var isSyncing  = false
    var lastError: String?

    // MARK: Private tokens

    private var accessToken:      String?
    private var refreshToken:     String?
    private var tokenExpiry:      Date?
    private var lifeOSCalendarID: String?

    // Keep a strong reference so the session isn't deallocated mid-flow
    private var authSession: ASWebAuthenticationSession?

    // MARK: Init

    override init() {
        super.init()
        loadPersistedState()
    }

    // MARK: - Connect / Disconnect

    func connect() async throws {
        // Build the Google OAuth URL
        var comps = URLComponents(string: authBase)!
        comps.queryItems = [
            .init(name: "client_id",     value: Self.clientID),
            .init(name: "redirect_uri",  value: Self.redirectURI),
            .init(name: "response_type", value: "code"),
            .init(name: "scope",         value: Self.scope),
            .init(name: "access_type",   value: "offline"),
            .init(name: "prompt",        value: "consent")   // ensures refresh token is returned
        ]
        guard let authURL = comps.url else {
            throw GCalError.authFailed("Could not build auth URL — check client ID.")
        }

        // Open the browser-based sign-in flow
        let callbackURL: URL = try await withCheckedThrowingContinuation { cont in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let session = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: Self.redirectScheme
                ) { url, error in
                    if let error {
                        if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                            cont.resume(throwing: GCalError.authCancelled)
                        } else {
                            cont.resume(throwing: GCalError.authFailed(error.localizedDescription))
                        }
                    } else if let url {
                        cont.resume(returning: url)
                    } else {
                        cont.resume(throwing: GCalError.authFailed("No callback URL received."))
                    }
                }
                session.presentationContextProvider = self
                session.prefersEphemeralWebBrowserSession = false
                self.authSession = session
                session.start()
            }
        }

        // Pull the authorization code out of the redirect URL
        guard
            let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
            let code = components.queryItems?.first(where: { $0.name == "code" })?.value
        else { throw GCalError.authFailed("Authorization code missing from callback.") }

        // Exchange code → access + refresh tokens
        try await exchangeCode(code)

        // Make sure the "LifeOS" Google Calendar exists (creates it if not)
        try await ensureLifeOSCalendar()

        isConnected = true
    }

    func disconnect() {
        accessToken = nil; refreshToken = nil
        tokenExpiry = nil; lifeOSCalendarID = nil
        isConnected = false
        let ud = UserDefaults.standard
        ["lifeos.gcal.accessToken", "lifeos.gcal.refreshToken",
         "lifeos.gcal.tokenExpiry", "lifeos.gcal.calendarID"].forEach { ud.removeObject(forKey: $0) }
    }

    // MARK: - Sync one assignment

    /// Creates or updates the Google Calendar event for a school assignment.
    /// Writes the event ID back to `task.gcalEventID` so future calls update instead of duplicate.
    func syncAssignment(_ task: Task) async throws {
        guard isConnected else { throw GCalError.notConnected }
        guard let dueDate = task.dueDate else { return }

        let token = try await validToken()
        let calID = try await calendarID()

        // All-day event: end date is exclusive (next day)
        let start = isoDate(dueDate)
        let end   = isoDate(Calendar.current.date(byAdding: .day, value: 1, to: dueDate) ?? dueDate)
        let body: [String: Any] = [
            "summary":     task.title,
            "description": task.notes.isEmpty ? "Added via LifeOS" : task.notes,
            "start": ["date": start],
            "end":   ["date": end]
        ]

        if let existingID = task.gcalEventID {
            // Update
            let url = URL(string: "\(calBase)/calendars/\(calID)/events/\(existingID)")!
            try await apiRequest(url: url, method: "PUT", body: body, token: token)
        } else {
            // Create
            let url = URL(string: "\(calBase)/calendars/\(calID)/events")!
            let response = try await apiRequest(url: url, method: "POST", body: body, token: token)
            if let id = response["id"] as? String {
                task.gcalEventID = id
            }
        }
    }

    /// Deletes the Google Calendar event linked to a task, then clears the stored ID.
    func deleteEvent(for task: Task) async throws {
        guard isConnected, let eventID = task.gcalEventID else { return }
        let token = try await validToken()
        let calID = try await calendarID()
        let url   = URL(string: "\(calBase)/calendars/\(calID)/events/\(eventID)")!
        var req   = URLRequest(url: url)
        req.httpMethod = "DELETE"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try await URLSession.shared.data(for: req)
        task.gcalEventID = nil
    }

    /// Syncs all incomplete school assignments that have a due date.
    func syncAll(_ tasks: [Task]) async throws {
        isSyncing = true
        defer { isSyncing = false }
        for task in tasks where task.category == .school && task.dueDate != nil && !task.isCompleted {
            try await syncAssignment(task)
        }
    }

    // MARK: - Token management

    private func exchangeCode(_ code: String) async throws {
        let params: [String: String] = [
            "code":         code,
            "client_id":    Self.clientID,
            "redirect_uri": Self.redirectURI,
            "grant_type":   "authorization_code"
        ]
        let (data, _) = try await postForm(to: tokenURL, params: params)
        try storeTokens(from: data)
    }

    private func validToken() async throws -> String {
        // Return cached token if still valid
        if let token = accessToken, let expiry = tokenExpiry, expiry > Date() {
            return token
        }
        // Refresh
        guard let refresh = refreshToken else {
            isConnected = false
            throw GCalError.notConnected
        }
        let params: [String: String] = [
            "refresh_token": refresh,
            "client_id":     Self.clientID,
            "grant_type":    "refresh_token"
        ]
        let (data, _) = try await postForm(to: tokenURL, params: params)
        try storeTokens(from: data)
        guard let token = accessToken else { throw GCalError.authFailed("Token refresh returned no token.") }
        return token
    }

    private func storeTokens(from data: Data) throws {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw GCalError.authFailed("Invalid token JSON.")
        }
        if let errDesc = json["error_description"] as? String {
            throw GCalError.authFailed(errDesc)
        }
        guard let access = json["access_token"] as? String else {
            throw GCalError.authFailed("No access_token in response.")
        }
        accessToken  = access
        if let r = json["refresh_token"] as? String { refreshToken = r }
        let ttl = json["expires_in"] as? Double ?? 3600
        tokenExpiry = Date().addingTimeInterval(ttl - 60)
        persistTokens()
    }

    // MARK: - Calendar management

    private func ensureLifeOSCalendar() async throws {
        // Check if we already have it stored
        if lifeOSCalendarID != nil { return }

        let token = try await validToken()
        let listURL = URL(string: "\(calBase)/users/me/calendarList")!
        let list = try await apiRequest(url: listURL, method: "GET", token: token)

        if let items = list["items"] as? [[String: Any]],
           let match = items.first(where: { $0["summary"] as? String == "LifeOS" }),
           let id = match["id"] as? String {
            lifeOSCalendarID = id
        } else {
            // Create "LifeOS" calendar
            let createURL = URL(string: "\(calBase)/calendars")!
            let created = try await apiRequest(
                url: createURL, method: "POST",
                body: ["summary": "LifeOS"],
                token: token
            )
            guard let id = created["id"] as? String else { throw GCalError.noCalendar }
            lifeOSCalendarID = id
        }
        UserDefaults.standard.set(lifeOSCalendarID, forKey: "lifeos.gcal.calendarID")
    }

    private func calendarID() async throws -> String {
        if let id = lifeOSCalendarID { return id }
        try await ensureLifeOSCalendar()
        guard let id = lifeOSCalendarID else { throw GCalError.noCalendar }
        return id
    }

    // MARK: - HTTP helpers

    @discardableResult
    private func apiRequest(
        url: URL, method: String,
        body: [String: Any]? = nil,
        token: String
    ) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code == 204 || data.isEmpty { return [:] }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw GCalError.apiError(code, "Non-JSON response.")
        }
        if code >= 400 {
            let msg = (json["error"] as? [String: Any])?["message"] as? String ?? "Unknown error"
            throw GCalError.apiError(code, msg)
        }
        return json
    }

    private func postForm(to url: URL, params: [String: String]) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" }
            .joined(separator: "&")
            .data(using: .utf8)
        return try await URLSession.shared.data(for: req)
    }

    private func isoDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    // MARK: - Persistence

    private func persistTokens() {
        let ud = UserDefaults.standard
        ud.set(accessToken,  forKey: "lifeos.gcal.accessToken")
        ud.set(refreshToken, forKey: "lifeos.gcal.refreshToken")
        ud.set(tokenExpiry?.timeIntervalSince1970, forKey: "lifeos.gcal.tokenExpiry")
    }

    private func loadPersistedState() {
        let ud = UserDefaults.standard
        accessToken      = ud.string(forKey: "lifeos.gcal.accessToken")
        refreshToken     = ud.string(forKey: "lifeos.gcal.refreshToken")
        lifeOSCalendarID = ud.string(forKey: "lifeos.gcal.calendarID")
        if let t = ud.object(forKey: "lifeos.gcal.tokenExpiry") as? Double {
            tokenExpiry = Date(timeIntervalSince1970: t)
        }
        isConnected = accessToken != nil && refreshToken != nil
    }
}

// MARK: - Presentation context (required for ASWebAuthenticationSession)

extension GoogleCalendarService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
