import SwiftUI
import SwiftData

// MARK: - Add course form

struct AddCourseView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss)      private var dismiss
    @Environment(AppTheme.self)  private var theme

    @State private var name      = ""
    @State private var code      = ""
    @State private var professor = ""
    @State private var building  = ""
    @State private var room      = ""
    @State private var schedule  = ""
    @State private var colorHex  = "00D4FF"

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                Form {
                    // Name + code
                    Section {
                        TextField("Course name", text: $name)
                            .font(.appHeadline)
                        TextField("Course code  (e.g. MATH 202)", text: $code)
                            .font(.appBody)
                    } header: {
                        sectionHeader("COURSE")
                    }
                    .listRowBackground(Color.appSurface)

                    // Details
                    Section {
                        TextField("Professor", text: $professor)
                            .font(.appBody)
                        HStack {
                            TextField("Building", text: $building)
                                .font(.appBody)
                            TextField("Room", text: $room)
                                .font(.appBody)
                                .frame(width: 80)
                        }
                        TextField("Schedule  (e.g. MWF 9:00–10:15 AM)", text: $schedule)
                            .font(.appBody)
                    } header: {
                        sectionHeader("DETAILS")
                    }
                    .listRowBackground(Color.appSurface)

                    // Color picker
                    Section {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("Course color")
                                .font(.appBody)
                                .foregroundColor(.appTextPrimary)

                            // Show palette in two rows of 6
                            let palette = AppTheme.colorPalette
                            let row1 = Array(palette.prefix(6))
                            let row2 = Array(palette.dropFirst(6))

                            VStack(spacing: AppSpacing.sm) {
                                HStack(spacing: AppSpacing.md) {
                                    ForEach(row1) { preset in
                                        colorSwatch(preset)
                                    }
                                }
                                HStack(spacing: AppSpacing.md) {
                                    ForEach(row2) { preset in
                                        colorSwatch(preset)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, AppSpacing.xs)
                    } header: {
                        sectionHeader("COLOR")
                    }
                    .listRowBackground(Color.appSurface)
                }
                .scrollContentBackground(.hidden)
                .tint(Color(hex: colorHex))
            }
            .navigationTitle("New Class")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(canSave ? Color(hex: colorHex) : .appTextSecondary)
                        .disabled(!canSave)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: Color swatch

    private func colorSwatch(_ preset: AppTheme.ColorPreset) -> some View {
        Button {
            colorHex = preset.hex
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            ZStack {
                Circle()
                    .fill(preset.color)
                    .frame(width: 36, height: 36)
                if colorHex == preset.hex {
                    Circle()
                        .strokeBorder(.white, lineWidth: 2.5)
                        .frame(width: 36, height: 36)
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.black)
                }
            }
        }
        .buttonStyle(.plain)
        .scaleEffect(colorHex == preset.hex ? 1.12 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.6), value: colorHex)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1.5)
    }

    // MARK: Save

    private func save() {
        let course = Course(
            name:      name.trimmingCharacters(in: .whitespaces),
            code:      code.trimmingCharacters(in: .whitespaces),
            professor: professor.trimmingCharacters(in: .whitespaces),
            building:  building.trimmingCharacters(in: .whitespaces),
            room:      room.trimmingCharacters(in: .whitespaces),
            schedule:  schedule.trimmingCharacters(in: .whitespaces),
            colorHex:  colorHex
        )
        context.insert(course)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        dismiss()
    }
}
