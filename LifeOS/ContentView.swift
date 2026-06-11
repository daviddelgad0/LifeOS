import SwiftUI
import SwiftData

// Root tab bar.
// selectedTab lives in AppTheme so any view can switch tabs programmatically.
// The tint switches to the active tab's accent color as you navigate — each
// section feels visually distinct without being a different app.

struct ContentView: View {
    @Environment(AppTheme.self) private var theme

    var body: some View {
        @Bindable var theme = theme

        TabView(selection: $theme.selectedTab) {

            TodayView()
                .tabItem { Label("Today",    systemImage: "house.fill") }
                .tag(0)

            TasksView()
                .tabItem { Label("Tasks",    systemImage: "checkmark.circle.fill") }
                .tag(1)

            WorkoutsView()
                .tabItem { Label("Workouts", systemImage: "figure.strengthtraining.traditional") }
                .tag(2)

            SchoolView()
                .tabItem { Label("School",   systemImage: "graduationcap.fill") }
                .tag(3)

            CoachView()
                .tabItem { Label("Coach",    systemImage: "brain") }
                .tag(4)
        }
        // Switches live as you change tabs
        .tint(theme.activeAccent)
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [Task.self, Workout.self, WorkoutExercise.self, WorkoutSet.self, Course.self], inMemory: true)
        .environment(AppTheme())
        .preferredColorScheme(.dark)
}
