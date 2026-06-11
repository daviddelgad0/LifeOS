import SwiftUI

// MARK: - Settings screen

struct SettingsView: View {
    @Environment(AppTheme.self) private var theme
    @State private var nameInput      = ""
    @State private var showAPIKey     = false
    @State private var showWhoopError = false

    var body: some View {
        @Bindable var theme = theme

        ZStack {
            Color.appBackground.ignoresSafeArea()

            List {

                // MARK: Profile
                Section {
                    HStack {
                        Text("Your name")
                            .font(.appBody)
                            .foregroundColor(.appTextPrimary)
                        Spacer()
                        TextField("Name", text: $nameInput)
                            .font(.appBody)
                            .foregroundColor(theme.todayAccent)
                            .multilineTextAlignment(.trailing)
                            .onChange(of: nameInput) { _, new in theme.userName = new }
                    }
                } header: { sectionHeader("PROFILE") }
                .listRowBackground(Color.appSurface)

                // MARK: Accent colors — one picker per tab
                Section {
                    VStack(spacing: AppSpacing.xl) {
                        colorRow(label: "Today",    icon: "house.fill",                          hex: $theme.todayAccentHex)
                        colorRow(label: "Tasks",    icon: "checkmark.circle.fill",               hex: $theme.tasksAccentHex)
                        colorRow(label: "Workouts", icon: "figure.strengthtraining.traditional", hex: $theme.workoutsAccentHex)
                        colorRow(label: "School",   icon: "graduationcap.fill",                  hex: $theme.schoolAccentHex)
                        colorRow(label: "Coach",    icon: "brain",                               hex: $theme.coachAccentHex)
                    }
                    .padding(.vertical, AppSpacing.sm)
                } header: { sectionHeader("ACCENT COLORS") }
                .listRowBackground(Color.appSurface)

                // MARK: Workout
                Section {
                    HStack {
                        Text("Default rest time")
                            .font(.appBody)
                            .foregroundColor(.appTextPrimary)
                        Spacer()
                        Text(restLabel(theme.defaultRestSeconds))
                            .font(.appMonoSm)
                            .foregroundColor(theme.workoutsAccent)
                    }
                    Slider(
                        value: Binding(
                            get: { Double(theme.defaultRestSeconds) },
                            set: { theme.defaultRestSeconds = Int($0) }
                        ),
                        in: 30...300, step: 30
                    )
                    .tint(theme.workoutsAccent)
                } header: { sectionHeader("WORKOUT") }
                  footer: {
                    Text("Applied to new sessions. Active sessions keep their current timer.")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
                .listRowBackground(Color.appSurface)

                // MARK: Whoop
                Section {
                    whoopRow
                } header: { sectionHeader("WHOOP") }
                  footer: {
                    Text("Pulls your latest recovery score, HRV, sleep, and strain into LifeOS.")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
                .listRowBackground(Color.appSurface)

                // MARK: Google Calendar
                Section {
                    googleCalendarRow
                } header: { sectionHeader("GOOGLE CALENDAR") }
                  footer: {
                    Text("One-way sync pushes school assignments to a dedicated \"LifeOS\" calendar.")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
                .listRowBackground(Color.appSurface)

                // MARK: Integrations
                Section {
                    apiKeyRow(hex: $theme.anthropicKey)
                } header: { sectionHeader("INTEGRATIONS") }
                  footer: {
                    Text("Used for syllabus parsing (School tab). Get your key at console.anthropic.com")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
                .listRowBackground(Color.appSurface)

                // MARK: About
                Section {
                    infoRow("Version",   value: "1.0.0")
                    infoRow("Bundle ID", value: "com.daviddelgado.LifeOS")
                } header: { sectionHeader("ABOUT") }
                .listRowBackground(Color.appSurface)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { nameInput = theme.userName }
        .alert("Whoop Error", isPresented: $showWhoopError) {
            Button("OK") { }
        } message: {
            Text(WhoopService.shared.lastError ?? "Unknown error")
        }
    }

    // MARK: Color row — label + full 12-color scrollable palette

    private func colorRow(label: String, icon: String, hex: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            // Label with tab icon + current color dot
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: hex.wrappedValue))
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.appTextPrimary)
                Spacer()
                // Current color preview swatch
                Circle()
                    .fill(Color(hex: hex.wrappedValue))
                    .frame(width: 14, height: 14)
            }

            // Scrollable palette
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(AppTheme.colorPalette) { preset in
                        swatchButton(preset: preset, selectedHex: hex)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func swatchButton(preset: AppTheme.ColorPreset, selectedHex: Binding<String>) -> some View {
        let selected = selectedHex.wrappedValue == preset.hex
        return Button {
            selectedHex.wrappedValue = preset.hex
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            ZStack {
                Circle()
                    .fill(preset.color)
                    .frame(width: 34, height: 34)
                if selected {
                    Circle()
                        .strokeBorder(.white, lineWidth: 2.5)
                        .frame(width: 34, height: 34)
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.black)
                }
            }
        }
        .buttonStyle(.plain)
        .scaleEffect(selected ? 1.12 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.6), value: selected)
    }

    // MARK: Whoop row

    @ViewBuilder
    private var whoopRow: some View {
        let whoop = WhoopService.shared

        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "waveform.path.ecg")
                .font(.system(size: 13))
                .foregroundColor(whoop.isConnected ? theme.todayAccent : .appTextSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text("Whoop")
                    .font(.appBody)
                    .foregroundColor(.appTextPrimary)
                if whoop.isConnected, let r = whoop.recovery {
                    Text("Recovery \(r.score) · HRV \(Int(r.hrv))ms")
                        .font(.appCaption)
                        .foregroundColor(theme.todayAccent)
                } else {
                    Text(whoop.isConnected ? "Connected" : "Not connected")
                        .font(.appCaption)
                        .foregroundColor(whoop.isConnected ? theme.todayAccent : .appTextSecondary)
                }
            }

            Spacer()

            if whoop.isConnecting || whoop.isSyncing {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(theme.todayAccent)
                    .scaleEffect(0.8)
            } else {
                Button(whoop.isConnected ? "Disconnect" : "Connect") {
                    if whoop.isConnected {
                        whoop.disconnect()
                    } else {
                        whoop.lastError = nil
                        _Concurrency.Task { @MainActor in
                            do {
                                try await whoop.connect()
                            } catch {
                                whoop.lastError = error.localizedDescription
                                showWhoopError = true
                            }
                        }
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(whoop.isConnected ? .appDestructive : theme.todayAccent)
            }
        }

        if let err = whoop.lastError {
            Text(err)
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.appPriorityHigh)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Google Calendar row

    private var googleCalendarRow: some View {
        let gcal = GoogleCalendarService.shared
        return HStack(spacing: AppSpacing.sm) {
            Image(systemName: "calendar")
                .font(.system(size: 13))
                .foregroundColor(gcal.isConnected ? theme.schoolAccent : .appTextSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text("Google Calendar")
                    .font(.appBody)
                    .foregroundColor(.appTextPrimary)
                Text(gcal.isConnected ? "Connected" : "Not connected")
                    .font(.appCaption)
                    .foregroundColor(gcal.isConnected ? theme.schoolAccent : .appTextSecondary)
            }

            Spacer()

            if gcal.isSyncing {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(theme.schoolAccent)
                    .scaleEffect(0.8)
            } else {
                Button(gcal.isConnected ? "Disconnect" : "Connect") {
                    if gcal.isConnected {
                        gcal.disconnect()
                    } else {
                        _Concurrency.Task {
                            do {
                                try await gcal.connect()
                            } catch {
                                gcal.lastError = error.localizedDescription
                            }
                        }
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(gcal.isConnected ? .appDestructive : theme.schoolAccent)
            }
        }
    }

    // MARK: API key row

    private func apiKeyRow(hex: Binding<String>) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "key.fill")
                .font(.system(size: 13))
                .foregroundColor(theme.schoolAccent)
                .frame(width: 20)

            Text("Anthropic API Key")
                .font(.appBody)
                .foregroundColor(.appTextPrimary)

            Spacer()

            if showAPIKey {
                TextField("sk-ant-...", text: hex)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.trailing)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .frame(maxWidth: 160)
            } else {
                Text(hex.wrappedValue.isEmpty ? "Not set" : masked(hex.wrappedValue))
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(hex.wrappedValue.isEmpty ? .appTextSecondary : theme.schoolAccent)
            }

            Button {
                showAPIKey.toggle()
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            } label: {
                Image(systemName: showAPIKey ? "eye.slash" : "eye")
                    .font(.system(size: 13))
                    .foregroundColor(.appTextSecondary)
            }
            .buttonStyle(.plain)
        }
    }

    /// Shows the last 4 characters of the key, rest masked.
    private func masked(_ key: String) -> String {
        guard key.count > 4 else { return String(repeating: "•", count: key.count) }
        let tail = String(key.suffix(4))
        return "••••••••" + tail
    }

    // MARK: Helpers

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1.5)
    }

    private func infoRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).font(.appBody).foregroundColor(.appTextPrimary)
            Spacer()
            Text(value).font(.appCaption).foregroundColor(.appTextSecondary)
        }
    }

    private func restLabel(_ s: Int) -> String {
        s < 60 ? "\(s)s" : (s % 60 == 0 ? "\(s/60)m" : "\(s/60)m \(s%60)s")
    }
}
