import SwiftUI
import SwiftData

// MARK: - AI Coach chat screen

struct CoachView: View {
    @Environment(AppTheme.self) private var theme
    @Query(sort: \Workout.date, order: .reverse) private var workouts: [Workout]
    @Query(sort: \Task.createdAt, order: .reverse) private var allTasks: [Task]

    @State private var viewModel = CoachViewModel()
    @FocusState private var inputFocused: Bool

    // Dynamic suggestions based on context
    private var suggestions: [String] {
        var s: [String] = []
        let whoop = WhoopService.shared

        if let r = whoop.recovery {
            if r.score < 34 {
                s.append("My recovery is low — what should I do today?")
                s.append("Best active recovery options for a red recovery day?")
            } else if r.score < 67 {
                s.append("Recovery is moderate — what's a smart training approach?")
            } else {
                s.append("Recovery is green — what should I train today?")
            }
        }

        if let last = workouts.first {
            let days = Calendar.current.dateComponents([.day], from: last.date, to: Date()).day ?? 0
            if days >= 2 { s.append("It's been \(days) days since my last session — let's go.") }
        } else {
            s.append("Build me a beginner training program")
        }

        let overdue = allTasks.filter { $0.isOverdue && !$0.isCompleted }
        if overdue.count > 2 { s.append("I have \(overdue.count) overdue tasks — help me prioritize") }

        s.append(contentsOf: [
            "Build me a 4-day split",
            "Help me with progressive overload",
            "How should I structure my week?"
        ])

        return Array(s.prefix(6))
    }

    // Streak for context injection
    private var streak: Int {
        let cal = Calendar.current
        var count = 0
        var day = cal.startOfDay(for: Date())
        while true {
            let hadTask = allTasks.contains {
                $0.isCompleted &&
                ($0.completedAt.map { cal.isDate($0, inSameDayAs: day) } == true)
            }
            guard hadTask else { break }
            count += 1
            day = cal.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: AppSpacing.sm) {
                                if viewModel.messages.isEmpty {
                                    emptyState
                                } else {
                                    ForEach(viewModel.messages) { msg in
                                        MessageBubble(message: msg, accent: theme.coachAccent)
                                            .id(msg.id)
                                    }
                                    if viewModel.isLoading {
                                        TypingIndicator(accent: theme.coachAccent)
                                            .id("typing")
                                    }
                                }
                            }
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.md)
                            .padding(.bottom, AppSpacing.sm)
                        }
                        .onChange(of: viewModel.messages.count) { _, _ in
                            scrollToBottom(proxy: proxy)
                        }
                        .onChange(of: viewModel.isLoading) { _, _ in
                            scrollToBottom(proxy: proxy)
                        }
                    }

                    Divider()
                        .background(Color.appSeparator)

                    inputBar
                }
            }
            .navigationTitle("AI Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        let w = Array(workouts)
                        let t = Array(allTasks)
                        let s = streak
                        let name = theme.userName
                        _Concurrency.Task {
                            await viewModel.dailyDigest(
                                userName: name, workouts: w, tasks: t, streak: s
                            )
                        }
                    } label: {
                        Label("Daily Digest", systemImage: "newspaper")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(viewModel.isDigesting ? .appTextSecondary : theme.coachAccent)
                    }
                    .disabled(viewModel.isDigesting || viewModel.isLoading)
                }
            }
        }
    }

    // MARK: Empty state with suggestions

    private var emptyState: some View {
        VStack(spacing: AppSpacing.xl) {
            VStack(spacing: AppSpacing.sm) {
                ZStack {
                    Circle()
                        .fill(theme.coachAccent.opacity(0.15))
                        .frame(width: 72, height: 72)
                    Image(systemName: "brain")
                        .font(.system(size: 32))
                        .foregroundColor(theme.coachAccent)
                }

                Text("Your AI Coach")
                    .font(.appTitle)
                    .foregroundColor(.appTextPrimary)

                Text(openingLine)
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.lg)
            }
            .padding(.top, AppSpacing.xl)

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text("TRY ASKING")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                    .padding(.horizontal, AppSpacing.xs)

                LazyVGrid(
                    columns: [GridItem(.flexible()), GridItem(.flexible())],
                    spacing: AppSpacing.sm
                ) {
                    ForEach(suggestions, id: \.self) { prompt in
                        Button {
                            viewModel.inputText = prompt
                            sendMessage()
                        } label: {
                            Text(prompt)
                                .font(.appCaption)
                                .foregroundColor(.appTextPrimary)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(AppSpacing.sm)
                                .background(Color.appSurface)
                                .cornerRadius(AppRadius.sm)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, AppSpacing.md)

            Spacer()
        }
    }

    private var openingLine: String {
        guard let last = workouts.first else {
            return "Let's build your training program from scratch."
        }
        let days = Calendar.current.dateComponents([.day], from: last.date, to: Date()).day ?? 0
        switch days {
        case 0:  return "You trained today — looking to plan tomorrow?"
        case 1:  return "One rest day in. Ask me what's next."
        case 2:  return "Two days of rest — you're probably ready to go."
        default: return "It's been \(days) days. Let's get you back on track."
        }
    }

    // MARK: Input bar

    private var inputBar: some View {
        HStack(spacing: AppSpacing.sm) {
            TextField("Ask your coach…", text: $viewModel.inputText, axis: .vertical)
                .font(.appBody)
                .foregroundColor(.appTextPrimary)
                .lineLimit(1...4)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, 10)
                .background(Color.appSurface)
                .cornerRadius(AppRadius.md)
                .focused($inputFocused)
                .onSubmit { sendMessage() }

            Button {
                sendMessage()
            } label: {
                Image(systemName: viewModel.isLoading ? "ellipsis" : "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.black)
                    .frame(width: 36, height: 36)
                    .background(
                        canSend ? theme.coachAccent : Color.appSurface2
                    )
                    .clipShape(Circle())
            }
            .disabled(!canSend)
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, AppSpacing.sm)
        .background(Color.appBackground)
    }

    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && !viewModel.isLoading
    }

    // MARK: Helpers

    private func sendMessage() {
        guard canSend else { return }
        inputFocused = false
        let currentWorkouts = Array(workouts)
        let currentTasks    = Array(allTasks)
        let currentStreak   = streak
        let userName        = theme.userName
        _Concurrency.Task {
            await viewModel.send(
                userName: userName,
                workouts: currentWorkouts,
                tasks:    currentTasks,
                streak:   currentStreak
            )
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) {
            if viewModel.isLoading {
                proxy.scrollTo("typing", anchor: .bottom)
            } else if let last = viewModel.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}

// MARK: - Message bubble

struct MessageBubble: View {
    let message: ChatMessage
    let accent:  Color

    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }

            Text(message.content)
                .font(.appBody)
                .foregroundColor(isUser ? .black : .appTextPrimary)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(isUser ? accent : Color.appSurface)
                .cornerRadius(AppRadius.md)
                .cornerRadius(isUser ? 4 : AppRadius.md,
                              corners: isUser ? .bottomRight : .bottomLeft)

            if !isUser { Spacer(minLength: 48) }
        }
    }
}

// MARK: - Typing indicator

struct TypingIndicator: View {
    let accent: Color
    @State private var phase = 0

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(accent)
                        .frame(width: 6, height: 6)
                        .opacity(phase == i ? 1.0 : 0.3)
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
            Spacer()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.4).repeatForever()) {
                phase = (phase + 1) % 3
            }
        }
    }
}

// MARK: - Corner radius helper

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius:  CGFloat      = 12
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
