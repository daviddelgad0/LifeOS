import UserNotifications

// MARK: - Local notification service
//
// Regular tasks:         9 AM on due date.
// School assignments:    9 AM at 7d, 3d, 1d, and day-of before due date.
//
// Call schedule(for:) after creating or un-completing a task.
// Call cancel(for:)   before deleting or when a task is marked complete.

final class NotificationService {

    static let shared = NotificationService()
    private init() {}

    // MARK: Permission

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { _, _ in }
    }

    // MARK: Schedule

    func schedule(for task: Task) {
        guard let dueDate = task.dueDate, !task.isCompleted else { return }
        cancel(for: task) // wipe stale requests before rescheduling

        if task.category == .school {
            scheduleSchoolReminders(for: task, dueDate: dueDate)
        } else {
            scheduleDayOf(for: task, dueDate: dueDate)
        }
    }

    // MARK: Cancel

    func cancel(for task: Task) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: identifiers(for: task))
    }

    // MARK: Private — school (4 reminders)

    private func scheduleSchoolReminders(for task: Task, dueDate: Date) {
        let schedule: [(days: Int, suffix: String, body: String)] = [
            (7, "7d", "Due in 1 week"),
            (3, "3d", "Due in 3 days"),
            (1, "1d", "Due tomorrow"),
            (0, "0d", "Due today")
        ]
        for item in schedule {
            guard
                let fire = nineAM(daysBeforeDue: item.days, dueDate: dueDate),
                fire > Date()
            else { continue }
            post(id:    "\(task.id.uuidString)-\(item.suffix)",
                 title: task.title,
                 body:  item.body,
                 at:    fire)
        }
    }

    // MARK: Private — single day-of reminder

    private func scheduleDayOf(for task: Task, dueDate: Date) {
        guard let fire = nineAM(daysBeforeDue: 0, dueDate: dueDate), fire > Date() else { return }
        let body = task.priority == .high ? "⚡ Due today · High priority" : "Due today"
        post(id:    "\(task.id.uuidString)-due",
             title: task.title,
             body:  body,
             at:    fire)
    }

    // MARK: Helpers

    /// Returns 9:00 AM on the day that is `daysBeforeDue` days before `dueDate`.
    private func nineAM(daysBeforeDue days: Int, dueDate: Date) -> Date? {
        let cal = Calendar.current
        guard let day = cal.date(byAdding: .day, value: -days, to: dueDate) else { return nil }
        var c = cal.dateComponents([.year, .month, .day], from: day)
        c.hour = 9; c.minute = 0; c.second = 0
        return cal.date(from: c)
    }

    private func post(id: String, title: String, body: String, at date: Date) {
        let content      = UNMutableNotificationContent()
        content.title    = title
        content.body     = body
        content.sound    = .default

        let comps   = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }

    private func identifiers(for task: Task) -> [String] {
        let b = task.id.uuidString
        return ["\(b)-due", "\(b)-7d", "\(b)-3d", "\(b)-1d", "\(b)-0d"]
    }
}
