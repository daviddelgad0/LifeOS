import SwiftUI
import SwiftData
import UserNotifications

@main
struct LifeOSApp: App {
    @State private var theme = AppTheme()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(for: [
                    Task.self,
                    Workout.self,
                    WorkoutExercise.self,
                    WorkoutSet.self,
                    Course.self,
                    WorkoutTemplate.self,
                    TemplateExercise.self
                ])
                .environment(theme)
                .preferredColorScheme(.dark)
                .onAppear {
                    let center = UNUserNotificationCenter.current()
                    center.delegate = EnergyCheckInService.shared
                    center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
                    EnergyCheckInService.shared.scheduleCheckInNotifications()
                }
        }
    }
}
