import SwiftUI
import SwiftData

// MARK: - Workout detail screen

struct WorkoutDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme
    let workout: Workout

    @State private var templateSaved = false

    private var orderedExercises: [WorkoutExercise] {
        workout.exercises.sorted { $0.createdAt < $1.createdAt }
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ScrollView {
                LazyVStack(spacing: AppSpacing.md) {
                    summaryHeader
                    ForEach(orderedExercises) { exercise in
                        ExerciseDetailCard(exercise: exercise, accent: theme.workoutsAccent, context: context)
                    }
                }
                .padding(AppSpacing.md)
                .padding(.bottom, AppSpacing.xxl)
            }
        }
        .navigationTitle(workout.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    saveAsTemplate()
                } label: {
                    Image(systemName: templateSaved ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(templateSaved ? theme.workoutsAccent : .appTextSecondary)
                }
            }
        }
    }

    // MARK: Save as template

    private func saveAsTemplate() {
        guard !templateSaved else { return }
        let template = WorkoutTemplate(name: workout.name)
        context.insert(template)
        for (i, ex) in orderedExercises.enumerated() {
            let te = TemplateExercise(
                name:       ex.name,
                orderIndex: i,
                weight:     ex.lastSet?.weight ?? 0,
                reps:       ex.lastSet?.reps   ?? 8
            )
            context.insert(te)
            template.exercises.append(te)
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        withAnimation { templateSaved = true }
    }

    // MARK: Summary stats header

    private var summaryHeader: some View {
        HStack(spacing: 0) {
            statCell(value: workout.formattedDuration ?? "--", label: "DURATION")
            divider
            statCell(value: "\(workout.totalSets)",            label: "SETS")
            divider
            statCell(value: volumeDisplay,                     label: "VOLUME")
        }
        .padding(.vertical, AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.appMono)
                .foregroundColor(.appTextPrimary)
            Text(label)
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.appSeparator)
            .frame(width: 1, height: 36)
    }

    private var volumeDisplay: String {
        let v = workout.totalVolume
        return v >= 1000 ? String(format: "%.1fk", v / 1000) : "\(Int(v))"
    }
}

// MARK: - Exercise detail card

struct ExerciseDetailCard: View {
    let exercise: WorkoutExercise
    let accent:   Color
    let context:  ModelContext

    @State private var bestWeightID: UUID?
    @State private var bestVolumeID: UUID?

    private var orderedSets: [WorkoutSet] { exercise.orderedSets }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {

            HStack {
                Text(exercise.name.uppercased())
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)
                    .tracking(0.5)
                Spacer()
                Text("\(orderedSets.count) sets")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }

            // Column headers
            HStack {
                Text("SET").frame(width: 40, alignment: .leading)
                Spacer()
                Text("WEIGHT").frame(width: 80, alignment: .trailing)
                Text("REPS").frame(width: 44, alignment: .trailing)
                Text("VOL").frame(width: 60, alignment: .trailing)
            }
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1)

            Divider().background(Color.appSeparator)

            ForEach(Array(orderedSets.enumerated()), id: \.offset) { i, workoutSet in
                SetDetailRow(
                    index: i + 1,
                    workoutSet: workoutSet,
                    isWeightPR: workoutSet.id == bestWeightID,
                    isVolumePR: workoutSet.id == bestVolumeID,
                    accent: accent
                )
            }

            if orderedSets.count >= 2,
               let top = orderedSets.max(by: { $0.weight < $1.weight }) {
                Divider().background(Color.appSeparator)
                HStack {
                    Text("Best set:")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                    Text("\(top.weightDisplay) lb × \(top.reps)")
                        .font(.appCaption)
                        .foregroundColor(.appTextPrimary)
                    Spacer()
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
        .onAppear { loadBests() }
    }

    private func loadBests() {
        let (bw, bv) = PRService.allTimeBests(exerciseName: exercise.name, context: context)
        bestWeightID = bw?.id
        bestVolumeID = bv?.id
    }
}

// MARK: - Set detail row

struct SetDetailRow: View {
    let index:      Int
    let workoutSet: WorkoutSet
    let isWeightPR: Bool
    let isVolumePR: Bool
    let accent:     Color

    var body: some View {
        HStack {
            Text("\(index)")
                .font(.appMonoSm)
                .foregroundColor(.appTextSecondary)
                .frame(width: 40, alignment: .leading)

            Spacer()

            HStack(spacing: 4) {
                Text("\(workoutSet.weightDisplay) lb")
                    .font(.appMonoSm)
                    .foregroundColor(isWeightPR ? accent : .appTextPrimary)
                if isWeightPR {
                    PRBadge(label: "WPR", color: accent)
                }
            }
            .frame(width: 80, alignment: .trailing)

            Text("\(workoutSet.reps)")
                .font(.appMonoSm)
                .foregroundColor(.appTextPrimary)
                .frame(width: 44, alignment: .trailing)

            HStack(spacing: 4) {
                if isVolumePR && !isWeightPR {
                    PRBadge(label: "VPR", color: accent)
                }
                Text(volumeDisplay)
                    .font(.appMonoSm)
                    .foregroundColor(isVolumePR ? accent : .appTextSecondary)
            }
            .frame(width: 60, alignment: .trailing)
        }
    }

    private var volumeDisplay: String {
        workoutSet.volume >= 1000
            ? String(format: "%.1fk", workoutSet.volume / 1000)
            : "\(Int(workoutSet.volume))"
    }
}

// MARK: - PR badge chip

struct PRBadge: View {
    let label: String
    var color: Color = .appAccent   // default for previews; theme.workoutsAccent is passed in live code

    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .bold))
            .foregroundColor(.black)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(color)
            .cornerRadius(4)
    }
}
