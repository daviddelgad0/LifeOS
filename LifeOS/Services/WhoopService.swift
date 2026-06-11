import Foundation
import AuthenticationServices
import UIKit
import CryptoKit

// MARK: - Errors

enum WhoopError: LocalizedError {
    case notConnected
    case authCancelled
    case authFailed(String)
    case apiError(Int, String)

    var errorDescription: String? {
        switch self {
        case .notConnected:           return "Not connected to Whoop."
        case .authCancelled:          return "Sign-in was cancelled."
        case .authFailed(let m):      return "Auth failed: \(m)"
        case .apiError(let c, let m): return "Whoop API error \(c): \(m)"
        }
    }
}

// MARK: - Data models

struct WhoopRecovery {
    let score:     Int      // 0–100
    let hrv:       Double   // RMSSD ms
    let restingHR: Int      // bpm
    let spo2:      Double?  // %
    let skinTemp:  Double?  // °C
    let updatedAt: Date

    var scoreLabel: String {
        switch score {
        case 67...100: return "Recovered"
        case 34...66:  return "Moderate"
        default:       return "Low"
        }
    }
}

struct WhoopSleep {
    let performancePercent: Double
    let efficiencyPercent:  Double
    let hoursOfSleep:       Double
}

// MARK: - Service

// NOTE: Client secret is embedded here for personal-use only.
// Never ship an embedded client secret in a publicly distributed app.

@Observable
final class WhoopService: NSObject {

    static let shared = WhoopService()

    private static let clientID     = "3278fbfa-f300-41bf-966b-6dc6523a47c9"
    private static let clientSecret = "3d3ef168b7d14256e21571e44201ace63f21f463abea8974e2e97b3a1af7bbf2"
    private static let redirectScheme = "com.daviddelgado.lifeos"
    private static let redirectURI    = "com.daviddelgado.lifeos://whoop-callback"
    private static let scope = "read:recovery read:cycles read:sleep read:workout read:profile offline"

    private let authBase = "https://api.prod.whoop.com/oauth/oauth2/auth"
    private let tokenURL = URL(string: "https://api.prod.whoop.com/oauth/oauth2/token")!
    private let apiBase  = "https://api.prod.whoop.com/developer"

    // MARK: Observable state

    private(set) var isConnected = false
    var isConnecting = false
    var isSyncing    = false
    var lastError:   String?

    // MARK: Latest data (nil until first fetch)

    private(set) var recovery: WhoopRecovery?
    private(set) var sleep:    WhoopSleep?
    private(set) var strain:   Double?   // today's cycle strain (0–21)

    // MARK: Private tokens

    private var accessToken:  String?
    private var refreshToken: String?
    private var tokenExpiry:  Date?

    private var authSession: ASWebAuthenticationSession?

    // MARK: Init

    override init() {
        super.init()
        loadPersistedState()
    }

    // MARK: - Connect / Disconnect

    func connect() async throws {
        lastError    = nil
        isConnecting = true
        defer { isConnecting = false }

        let state        = UUID().uuidString
        let codeVerifier = makeRandomString(length: 64)
        let codeChallenge = Data(SHA256.hash(data: Data(codeVerifier.utf8)))
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        var comps = URLComponents(string: authBase)!
        comps.queryItems = [
            .init(name: "client_id",             value: Self.clientID),
            .init(name: "redirect_uri",           value: Self.redirectURI),
            .init(name: "response_type",          value: "code"),
            .init(name: "scope",                  value: Self.scope),
            .init(name: "state",                  value: state),
            .init(name: "code_challenge",         value: codeChallenge),
            .init(name: "code_challenge_method",  value: "S256"),
        ]
        guard let authURL = comps.url else {
            throw WhoopError.authFailed("Could not build auth URL.")
        }
        print("[Whoop] Auth URL: \(authURL)")

        let callbackURL: URL = try await withCheckedThrowingContinuation { cont in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let session = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: Self.redirectScheme
                ) { url, error in
                    if let error {
                        print("[Whoop] Auth session error: \(error)")
                        if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                            cont.resume(throwing: WhoopError.authCancelled)
                        } else {
                            cont.resume(throwing: WhoopError.authFailed(error.localizedDescription))
                        }
                    } else if let url {
                        print("[Whoop] Callback URL: \(url)")
                        cont.resume(returning: url)
                    } else {
                        print("[Whoop] No callback URL and no error")
                        cont.resume(throwing: WhoopError.authFailed("No callback URL received."))
                    }
                }
                session.presentationContextProvider = self
                session.prefersEphemeralWebBrowserSession = false
                self.authSession = session
                guard session.start() else {
                    cont.resume(throwing: WhoopError.authFailed(
                        "Could not open the sign-in browser. Check your Whoop app's redirect URI in the developer dashboard."
                    ))
                    return
                }
            }
        }

        guard
            let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
            let code = components.queryItems?.first(where: { $0.name == "code" })?.value
        else {
            let items = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let detail = items.first(where: { $0.name == "error_description" })?.value
                      ?? items.first(where: { $0.name == "error" })?.value
                      ?? callbackURL.absoluteString
            throw WhoopError.authFailed(detail)
        }

        try await exchangeCode(code, codeVerifier: codeVerifier)
        isConnected = true
        await fetchLatestData()
    }

    func disconnect() {
        accessToken = nil; refreshToken = nil; tokenExpiry = nil
        recovery = nil; sleep = nil; strain = nil
        isConnected = false
        ["lifeos.whoop.accessToken", "lifeos.whoop.refreshToken",
         "lifeos.whoop.tokenExpiry"].forEach { UserDefaults.standard.removeObject(forKey: $0) }
    }

    // MARK: - Data fetch

    func fetchLatestData() async {
        guard isConnected else { return }
        isSyncing = true
        defer { isSyncing = false }
        do {
            let token = try await validToken()
            async let r = fetchRecovery(token: token)
            async let s = fetchSleep(token: token)
            async let c = fetchStrain(token: token)
            let (rec, sl, st) = try await (r, s, c)
            recovery = rec
            sleep    = sl
            strain   = st
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Private fetchers

    private func fetchRecovery(token: String) async throws -> WhoopRecovery? {
        let url  = URL(string: "\(apiBase)/v2/recovery?limit=1")!
        let json = try await apiRequest(url: url, token: token)
        guard
            let records = json["records"] as? [[String: Any]],
            let first   = records.first,
            first["score_state"] as? String == "SCORED",
            let score   = first["score"] as? [String: Any],
            let rec     = score["recovery_score"] as? Double,
            let hrv     = score["hrv_rmssd_milli"] as? Double,
            let rhr     = score["resting_heart_rate"] as? Double
        else { return nil }

        let updated = iso8601(first["updated_at"] as? String ?? "") ?? Date()
        return WhoopRecovery(
            score:     Int(rec),
            hrv:       hrv,
            restingHR: Int(rhr),
            spo2:      score["spo2_percentage"] as? Double,
            skinTemp:  score["skin_temp_celsius"] as? Double,
            updatedAt: updated
        )
    }

    private func fetchSleep(token: String) async throws -> WhoopSleep? {
        let url  = URL(string: "\(apiBase)/v2/activity/sleep?limit=1")!
        let json = try await apiRequest(url: url, token: token)
        guard
            let records = json["records"] as? [[String: Any]],
            let first   = records.first,
            first["nap"] as? Bool == false,
            first["score_state"] as? String == "SCORED",
            let score   = first["score"] as? [String: Any],
            let perf    = score["sleep_performance_percentage"] as? Double,
            let eff     = score["sleep_efficiency_percentage"] as? Double
        else { return nil }

        var hours = 0.0
        if let stages = score["stage_summary"] as? [String: Any] {
            let light = stages["total_light_sleep_time_milli"] as? Double ?? 0
            let sws   = stages["total_slow_wave_sleep_time_milli"] as? Double ?? 0
            let rem   = stages["total_rem_sleep_time_milli"] as? Double ?? 0
            hours = (light + sws + rem) / 3_600_000
        }
        return WhoopSleep(performancePercent: perf, efficiencyPercent: eff, hoursOfSleep: hours)
    }

    private func fetchStrain(token: String) async throws -> Double? {
        let url  = URL(string: "\(apiBase)/v2/cycle?limit=1")!
        let json = try await apiRequest(url: url, token: token)
        guard
            let records = json["records"] as? [[String: Any]],
            let first   = records.first,
            first["score_state"] as? String == "SCORED",
            let score   = first["score"] as? [String: Any],
            let strain  = score["strain"] as? Double
        else { return nil }
        return strain
    }

    // MARK: - Token management

    private func exchangeCode(_ code: String, codeVerifier: String) async throws {
        let body: [String: String] = [
            "code":          code,
            "redirect_uri":  Self.redirectURI,
            "grant_type":    "authorization_code",
            "code_verifier": codeVerifier,
        ]
        let (data, _) = try await tokenRequest(body: body)
        try storeTokens(from: data)
    }

    private func validToken() async throws -> String {
        if let token = accessToken, let expiry = tokenExpiry, expiry > Date() {
            return token
        }
        guard let refresh = refreshToken else {
            isConnected = false
            throw WhoopError.notConnected
        }
        let body: [String: String] = [
            "refresh_token": refresh,
            "grant_type":    "refresh_token"
        ]
        let (data, _) = try await tokenRequest(body: body)
        try storeTokens(from: data)
        guard let token = accessToken else {
            throw WhoopError.authFailed("Token refresh returned no token.")
        }
        return token
    }

    private func tokenRequest(body: [String: String]) async throws -> (Data, URLResponse) {
        var req = URLRequest(url: tokenURL)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        var fullBody = body
        fullBody["client_id"]     = Self.clientID
        fullBody["client_secret"] = Self.clientSecret

        let bodyString = fullBody
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" }
            .joined(separator: "&")
        req.httpBody = bodyString.data(using: .utf8)

        print("[Whoop] Token request URL: \(tokenURL)")
        print("[Whoop] Token request body: \(bodyString)")

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let raw = String(data: data, encoding: .utf8) ?? "unreadable"
        print("[Whoop] Token response \(status): \(raw)")

        return (data, response)
    }

    private func storeTokens(from data: Data) throws {
        let raw = String(data: data, encoding: .utf8) ?? "unreadable"
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw WhoopError.authFailed("Invalid token JSON: \(raw)")
        }
        if let err = json["error_description"] as? String { throw WhoopError.authFailed(err) }
        if let err = json["error"] as? String { throw WhoopError.authFailed("\(err): \(raw)") }
        guard let access = json["access_token"] as? String else {
            throw WhoopError.authFailed("No access_token. Response: \(raw)")
        }
        accessToken = access
        if let r = json["refresh_token"] as? String { refreshToken = r }
        let ttl = json["expires_in"] as? Double ?? 3600
        tokenExpiry = Date().addingTimeInterval(ttl - 60)
        persistTokens()
    }

    // MARK: - HTTP helpers

    private func apiRequest(url: URL, token: String) async throws -> [String: Any] {
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw WhoopError.apiError(code, "Non-JSON response.")
        }
        if code >= 400 {
            let msg = json["message"] as? String ?? "Unknown error"
            throw WhoopError.apiError(code, msg)
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

    private func makeRandomString(length: Int) -> String {
        let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return (0..<length).map { _ in chars.randomElement()! }.map(String.init).joined()
    }

    private func iso8601(_ string: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }

    // MARK: - Persistence

    private func persistTokens() {
        let ud = UserDefaults.standard
        ud.set(accessToken,  forKey: "lifeos.whoop.accessToken")
        ud.set(refreshToken, forKey: "lifeos.whoop.refreshToken")
        ud.set(tokenExpiry?.timeIntervalSince1970, forKey: "lifeos.whoop.tokenExpiry")
    }

    private func loadPersistedState() {
        let ud = UserDefaults.standard
        accessToken  = ud.string(forKey: "lifeos.whoop.accessToken")
        refreshToken = ud.string(forKey: "lifeos.whoop.refreshToken")
        if let t = ud.object(forKey: "lifeos.whoop.tokenExpiry") as? Double {
            tokenExpiry = Date(timeIntervalSince1970: t)
        }
        isConnected = accessToken != nil && refreshToken != nil
    }
}

// MARK: - Presentation context

extension WhoopService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.keyWindow ?? UIWindow()
    }
}
