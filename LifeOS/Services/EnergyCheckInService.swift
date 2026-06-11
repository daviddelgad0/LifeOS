import Foundation
import UserNotifications

// MARK: - Check-in model

struct EnergyCheckIn: Codable, Identifiable {
    var id    = UUID()
    let date:  Date
    let level: Int   // 1 (drained) – 5 (peak)

    var emoji: String {
        switch level {
        case 1: return "😴"
        case 2: return "😐"
        case 3: return "🙂"
        case 4: return "😤"
        default: return "⚡"
        }
    }

    var label: String {
        switch level {
        case 1: return "Drained"
        case 2: return "Low"
        case 3: return "Okay"
        case 4: return "Pumped"
        default: return "Peak"
        }
    }
}

// MARK: - Service

@Observable
final class EnergyCheckInService: NSObject {

    static let shared = EnergyCheckInService()
    private override init() {
        super.init()
        loadCheckIns()
    }

    private(set) var checkIns: [EnergyCheckIn] = []
    var showingCheckIn = false

    // MARK: - Public API

    var last4: [EnergyCheckIn] { Array(checkIns.prefix(4)) }

    /// True when 3+ check-ins in the last 7 days had energy ≤ 2 after 2 PM.
    var hasAfternoonEnergyWarning: Bool {
        let cal    = Calendar.current
        let cutoff = cal.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        return checkIns.filter { c in
            c.date > cutoff &&
            c.level <= 2 &&
            cal.component(.hour, from: c.date) >= 14
        }.count >= 3
    }

    func log(level: Int) {
        let entry = EnergyCheckIn(date: Date(), level: max(1, min(5, level)))
        checkIns.insert(entry, at: 0)
        if checkIns.count > 56 { checkIns = Array(checkIns.prefix(56)) }
        save()
        showingCheckIn = false
    }

    // MARK: - Notifications (4 daily repeating)

    func scheduleCheckInNotifications() {
        let center = UNUserNotificationCenter.current()
        let ids = [9, 12, 15, 18].map { "lifeos.checkin.\($0)" }
        center.removePendingNotificationRequests(withIdentifiers: ids)

        for hour in [9, 12, 15, 18] {
            let content       = UNMutableNotificationContent()
            content.title     = "Energy check-in"
            content.body      = "How are you feeling right now?"
            content.sound     = .default

            var comps         = DateComponents()
            comps.hour        = hour
            comps.minute      = 0
            let trigger       = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
            let request       = UNNotificationRequest(
                identifier:   "lifeos.checkin.\(hour)",
                content:      content,
                trigger:      trigger
            )
            center.add(request, withCompletionHandler: nil)
        }
    }

    // MARK: - Persistence

    private func save() {
        guard let data = try? JSONEncoder().encode(checkIns) else { return }
        UserDefaults.standard.set(data, forKey: "lifeos.energyCheckIns")
    }

    private func loadCheckIns() {
        guard
            let data     = UserDefaults.standard.data(forKey: "lifeos.energyCheckIns"),
            let decoded  = try? JSONDecoder().decode([EnergyCheckIn].self, from: data)
        else { return }
        checkIns = decoded
    }
}

// MARK: - Notification delegate

extension EnergyCheckInService: UNUserNotificationCenterDelegate {

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if notification.request.identifier.hasPrefix("lifeos.checkin") {
            showingCheckIn = true
        }
        completionHandler([.sound, .banner])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if response.notification.request.identifier.hasPrefix("lifeos.checkin") {
            DispatchQueue.main.async { self.showingCheckIn = true }
        }
        completionHandler()
    }
}
