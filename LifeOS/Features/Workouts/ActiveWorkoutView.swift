import SwiftUI
import SwiftData

// MARK: - Active workout screen

struct ActiveWorkoutView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme
    let workout: Workout
    let onDismiss: () -> Void

    @State private var viewModel        = WorkoutSessionViewModel()
    @State private var showingCancelAlert = false
    @State private var prFlashIDs: Set<UUID> = []

    private var orderedExercises: [WorkoutExercise] {
        workout.exercises.sorted { $0.createdAt < $1.createdAt }
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    LazyVStack(spacing: AppSpacing.md) {
                        if orderedExercises.isEmpty {
                            emptyExercisePrompt
                        }

                        ForEach(orderedExercises) { exercise in
                            ExerciseCard(
                                exercise: exercise,
                                showPR:   prFlashIDs.contains(exercise.id),
                                accent:   theme.workoutsAccent
                            ) { reps, weight in
                                logSet(exercise: exercise, reps: reps, weight: weight)
                            }
                        }

                        addExerciseButton
                    }
                    .padding(AppSpacing.md)
                    .padding(.bottom, viewModel.isRestActive ? 220 : AppSpacing.xxl)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingCancelAlert = true }
                        .foregroundColor(.appDestructive)
                }
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 2) {
                        Text(workout.name)
                            .font(.appHeadline)
                            .foregroundColor(.appTextPrimary)
                        Text(viewModel.elapsedFormatted)
                            .font(.appMonoSm)
                            .foregroundColor(.appTextSecondary)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Finish") { finishWorkout() }
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(theme.workoutsAccent)
                }
            }
            .alert("Cancel Workout?", isPresented: $showingCancelAlert) {
                Button("Cancel Workout", role: .destructive) { cancelWorkout() }
                Button("Keep Going", role: .cancel) {}
            } message: {
                Text("This workout will not be saved.")
            }
            .sheet(isPresented: $viewModel.showingAddExercise) {
                addExerciseSheet
            }
        }
        .overlay(alignment: .bottom) {
            if viewModel.isRestActive {
                RestTimerPanel(viewModel: viewModel, accent: theme.workoutsAccent)
                    .padding(.bottom, AppSpacing.lg)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: viewModel.isRestActive)
        .onAppear {
            // Pick up the rest default the user set in Settings
            viewModel.defaultRestSeconds = theme.defaultRestSeconds
            viewModel.startElapsedTimer()
        }
        .onDisappear { viewModel.stopAll() }
    }

    // MARK: Sub-views

    private var emptyExercisePrompt: some View {
        Text("Add your first exercise.")
            .font(.appBody)
            .foregroundColor(.appTextSecondary)
            .multilineTextAlignment(.center)
            .padding(.top, AppSpacing.xxl)
    }

    private var addExerciseButton: some View {
        Button {
            viewModel.newExerciseName = ""
            viewModel.showingAddExercise = true
        } label: {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "plus")
                Text("Add Exercise")
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(theme.workoutsAccent)
            .frame(maxWidth: .infinity)
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
        }
    }

    // MARK: Add exercise sheet

    private var addExerciseSheet: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: AppSpacing.lg) {
                    TextField("Exercise name", text: $viewModel.newExerciseName)
                        .font(.appTitle)
                        .foregroundColor(.appTextPrimary)
                        .multilineTextAlignment(.center)
                        .autocorrectionDisabled()
                        .padding(AppSpacing.md)
                        .background(Color.appSurface)
                        .cornerRadius(AppRadius.md)
                        .padding(.horizontal, AppSpacing.lg)

                    let suggestions = [
                        "Bench Press", "Squat",
                        "Deadlift",    "Overhead Press",
                        "Barbell Row", "Pull-Up",
                        "Incline Press","Leg Press",
                        "Romanian Deadlift", "Dumbbell Curl"
                    ]
                    LazyVGrid(
                        columns: [GridItem(.flexible()), GridItem(.flexible())],
                        spacing: AppSpacing.sm
                    ) {
                        ForEach(suggestions, id: \.self) { name in
                            Button(name) { viewModel.newExerciseName = name }
                                .font(.appBody)
                                .foregroundColor(.appTextPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(AppSpacing.sm)
                                .background(Color.appSurface)
                                .cornerRadius(AppRadius.sm)
                        }
                    }
                    .padding(.horizontal, AppSpacing.lg)

                    Spacer()
                }
                .padding(.top, AppSpacing.lg)
            }
            .navigationTitle("Add Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { viewModel.showingAddExercise = false }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    let trimmed = viewModel.newExerciseName.trimmingCharacters(in: .whitespaces)
                    Button("Add") { addExercise() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(trimmed.isEmpty ? .appTextSecondary : theme.workoutsAccent)
                        .disabled(trimmed.isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: Actions

    private func logSet(exercise: WorkoutExercise, reps: Int, weight: Double) {
        let set = WorkoutSet(reps: reps, weight: weight)
        context.insert(set)
        exercise.sets.append(set)
        viewModel.startRestTimer()

        let prResult = PRService.check(
            newSet: set,
            exerciseName: exercise.name,
            currentWorkoutID: workout.id,
            context: context
        )
        if prResult.isPR {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            prFlashIDs.insert(exercise.id)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                prFlashIDs.remove(exercise.id)
            }
        } else {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    private func addExercise() {
        let name = viewModel.newExerciseName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        let exercise = WorkoutExercise(name: name)
        context.insert(exercise)
        workout.exercises.append(exercise)
        viewModel.newExerciseName = ""
        viewModel.showingAddExercise = false
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func finishWorkout() {
        workout.endDate = Date()
        viewModel.stopAll()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        generateRecap()
        onDismiss()
    }

    private func generateRecap() {
        let name      = workout.name
        let exercises = workout.exercises.sorted { $0.createdAt < $1.createdAt }
        let summary   = exercises.map { ex -> String in
            let top = ex.sets.max { $0.weight < $1.weight }
            return "\(ex.name): \(ex.sets.count) sets, top \(top.map { "\(Int($0.weight))lb × \($0.reps)" } ?? "N/A")"
        }.joined(separator: "; ")
        let dur = workout.formattedDuration ?? "unknown duration"
        let prompt = """
        Workout: \(name), \(dur), \(workout.totalSets) sets, \(Int(workout.totalVolume))lb total.
        Exercises: \(summary.isEmpty ? "none logged" : summary).
        Write exactly 2 punchy sentences recapping this workout. Be specific and motivating. No fluff.
        """
        _Concurrency.Task {
            if let recap = try? await AnthropicService.shared.complete(prompt: prompt, maxTokens: 120) {
                workout.aiRecap = recap.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
    }

    private func cancelWorkout() {
        viewModel.stopAll()
        context.delete(workout)
        onDismiss()
    }
}

// MARK: - Exercise card

struct ExerciseCard: View {
    let exercise: WorkoutExercise
    let showPR:   Bool
    let accent:   Color          // passed from parent so theme changes propagate
    let onLogSet: (Int, Double) -> Void

    @State private var repsText   = "8"
    @State private var weightText = "135"

    private var orderedSets: [WorkoutSet] { exercise.orderedSets }
    private var canLog: Bool { Int(repsText) != nil && Double(weightText) != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {

            // Name + PR badge
            HStack {
                Text(exercise.name.uppercased())
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)
                    .tracking(0.5)
                Spacer()
                if showPR {
                    Text("PR")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.black)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(accent)
                        .cornerRadius(AppRadius.sm)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: showPR)

            // Logged sets
            if !orderedSets.isEmpty {
                VStack(spacing: AppSpacing.xs) {
                    ForEach(Array(orderedSets.enumerated()), id: \.offset) { i, set in
                        HStack {
                            Text("Set \(i + 1)")
                                .font(.appCaption)
                                .foregroundColor(.appTextSecondary)
                                .frame(width: 44, alignment: .leading)
                            Text("\(set.weightDisplay) lb  ×  \(set.reps)")
                                .font(.appMonoSm)
                                .foregroundColor(.appTextPrimary)
                            Spacer()
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(accent)
                        }
                    }
                }
                Divider().background(Color.appSeparator)
            }

            // Input row
            HStack(spacing: AppSpacing.sm) {
                VStack(alignment: .center, spacing: 4) {
                    Text("WEIGHT").font(.appCaption).foregroundColor(.appTextSecondary).tracking(1)
                    TextField("0", text: $weightText)
                        .keyboardType(.decimalPad)
                        .font(.appMono)
                        .foregroundColor(.appTextPrimary)
                        .multilineTextAlignment(.center)
                        .frame(width: 76)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color.appSurface2)
                        .cornerRadius(AppRadius.sm)
                }

                Text("×")
                    .font(.appHeadline)
                    .foregroundColor(.appTextSecondary)
                    .padding(.top, AppSpacing.md)

                VStack(alignment: .center, spacing: 4) {
                    Text("REPS").font(.appCaption).foregroundColor(.appTextSecondary).tracking(1)
                    TextField("0", text: $repsText)
                        .keyboardType(.numberPad)
                        .font(.appMono)
                        .foregroundColor(.appTextPrimary)
                        .multilineTextAlignment(.center)
                        .frame(width: 56)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color.appSurface2)
                        .cornerRadius(AppRadius.sm)
                }

                Spacer()

                Button {
                    guard let r = Int(repsText), let w = Double(weightText) else { return }
                    onLogSet(r, w)
                } label: {
                    Text("LOG SET")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(canLog ? .black : .appTextSecondary)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, 13)
                        .background(canLog ? accent : Color.appSurface2)
                        .cornerRadius(AppRadius.sm)
                }
                .disabled(!canLog)
                .padding(.top, AppSpacing.md)
            }
        }
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
        .onAppear {
            if let last = orderedSets.last {
                // Already has logged sets — use the most recent
                repsText   = "\(last.reps)"
                weightText = last.weightDisplay
            } else if exercise.suggestedWeight > 0 {
                // Started from a template or repeat — use suggested values
                repsText   = "\(exercise.suggestedReps)"
                weightText = exercise.suggestedWeight == floor(exercise.suggestedWeight)
                    ? "\(Int(exercise.suggestedWeight))"
                    : String(format: "%.1f", exercise.suggestedWeight)
            }
        }
    }
}

// MARK: - Rest timer panel

struct RestTimerPanel: View {
    let viewModel: WorkoutSessionViewModel
    let accent:    Color

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Text("REST")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(2)

            ZStack {
                Ring(progress: viewModel.restProgress, lineWidth: 5, color: accent)
                    .frame(width: 80, height: 80)
                Text(viewModel.restFormatted)
                    .font(.appMono)
                    .foregroundColor(.appTextPrimary)
            }

            HStack(spacing: AppSpacing.md) {
                Button("SKIP") { viewModel.skipRest() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.appTextSecondary)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(Color.appSurface2)
                    .cornerRadius(AppRadius.sm)

                Button("+30s") { viewModel.addRestTime(30) }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(accent)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(Color.appSurface2)
                    .cornerRadius(AppRadius.sm)
            }
        }
        .padding(.horizontal, AppSpacing.xl)
        .padding(.vertical, AppSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .fill(Color.appSurface)
                .shadow(color: .black.opacity(0.6), radius: 24, y: -4)
        )
        .padding(.horizontal, AppSpacing.md)
    }
}
