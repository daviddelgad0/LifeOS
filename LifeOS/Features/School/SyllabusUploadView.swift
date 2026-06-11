import SwiftUI
import SwiftData
import PhotosUI
import PDFKit

// MARK: - Syllabus upload → parse → import sheet

struct SyllabusUploadView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss)      private var dismiss
    @Environment(AppTheme.self)  private var theme
    let course: Course

    // MARK: State machine

    enum UploadState: Equatable {
        case idle
        case parsing
        case results
        case error(String)

        static func == (lhs: UploadState, rhs: UploadState) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle), (.parsing, .parsing), (.results, .results): return true
            case (.error(let a), .error(let b)): return a == b
            default: return false
            }
        }
    }

    @State private var uploadState:   UploadState = .idle
    @State private var assignments:   [ParsedAssignment] = []
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showFilePicker = false

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                switch uploadState {
                case .idle:    idleView
                case .parsing: parsingView
                case .results: resultsView
                case .error(let msg): errorView(msg)
                }
            }
            .navigationTitle("Upload Syllabus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.appTextSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onChange(of: selectedPhoto) { newItem in
            guard let newItem else { return }
            _Concurrency.Task { await loadPhoto(newItem) }
        }
    }

    // MARK: - Idle view

    private var idleView: some View {
        VStack(spacing: AppSpacing.xl) {
            Spacer()

            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .fill(course.color.opacity(0.12))
                    .frame(width: 96, height: 96)
                Image(systemName: "doc.text.magnifyingglass")
                    .font(.system(size: 44))
                    .foregroundColor(course.color)
            }

            // Copy
            VStack(spacing: AppSpacing.sm) {
                Text("Upload Your Syllabus")
                    .font(.appTitle)
                    .foregroundColor(.appTextPrimary)
                Text("Claude will scan it and pull out every assignment and deadline automatically.")
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xl)
            }

            // Pickers
            VStack(spacing: AppSpacing.md) {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    pickerButton(icon: "photo.fill", label: "Choose Photo or Screenshot")
                }
                .buttonStyle(.plain)

                Button { showFilePicker = true } label: {
                    pickerButton(icon: "doc.fill", label: "Choose PDF")
                }
            }
            .padding(.horizontal, AppSpacing.lg)

            Spacer()
        }
        .fileImporter(isPresented: $showFilePicker, allowedContentTypes: [.pdf]) { result in
            _Concurrency.Task { await loadFile(result) }
        }
    }

    private func pickerButton(icon: String, label: String) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: icon)
            Text(label)
                .font(.system(size: 15, weight: .semibold))
        }
        .foregroundColor(.black)
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.md)
        .background(course.color)
        .cornerRadius(AppRadius.md)
    }

    // MARK: - Parsing view

    private var parsingView: some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer()
            ProgressView()
                .progressViewStyle(.circular)
                .tint(course.color)
                .scaleEffect(1.6)
            VStack(spacing: AppSpacing.sm) {
                Text("Reading your syllabus…")
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)
                Text("Claude is scanning for assignments and due dates.")
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xl)
            }
            Spacer()
        }
    }

    // MARK: - Results view

    private var resultsView: some View {
        VStack(spacing: 0) {

            // Header
            VStack(spacing: AppSpacing.xs) {
                if assignments.isEmpty {
                    Text("No assignments found")
                        .font(.appTitle)
                        .foregroundColor(.appTextPrimary)
                    Text("Try a clearer photo or a different page.")
                        .font(.appBody)
                        .foregroundColor(.appTextSecondary)
                } else {
                    Text("\(assignments.count) assignment\(assignments.count == 1 ? "" : "s") found")
                        .font(.appTitle)
                        .foregroundColor(.appTextPrimary)
                    Text("Tap to deselect any you don't want.")
                        .font(.appBody)
                        .foregroundColor(.appTextSecondary)
                }
            }
            .padding(AppSpacing.lg)

            if assignments.isEmpty {
                Spacer()
                Button("Try Again") { uploadState = .idle }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.black)
                    .padding(.horizontal, AppSpacing.xl)
                    .padding(.vertical, AppSpacing.sm)
                    .background(course.color)
                    .cornerRadius(AppRadius.md)
                Spacer()
            } else {
                List {
                    ForEach(assignments.indices, id: \.self) { i in
                        assignmentRow(index: i)
                            .listRowBackground(Color.appSurface)
                            .listRowSeparatorTint(Color.appSeparator)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)

                // Import button
                let selectedCount = assignments.filter(\.isSelected).count
                Button {
                    importAssignments()
                } label: {
                    Text(selectedCount == 0
                         ? "No Assignments Selected"
                         : "Import \(selectedCount) Assignment\(selectedCount == 1 ? "" : "s")")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(selectedCount == 0 ? .appTextSecondary : .black)
                        .frame(maxWidth: .infinity)
                        .padding(AppSpacing.md)
                        .background(selectedCount == 0 ? Color.appSurface2 : course.color)
                        .cornerRadius(AppRadius.md)
                }
                .disabled(selectedCount == 0)
                .padding(AppSpacing.lg)
            }
        }
    }

    private func assignmentRow(index i: Int) -> some View {
        let a = assignments[i]
        return HStack(spacing: AppSpacing.md) {
            Image(systemName: a.isSelected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20))
                .foregroundColor(a.isSelected ? course.color : .appTextSecondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(a.title)
                    .font(.appBody)
                    .foregroundColor(a.isSelected ? .appTextPrimary : .appTextSecondary)

                if let due = a.dueDate {
                    Text("Due " + due.formatted(date: .abbreviated, time: .omitted))
                        .font(.appCaption)
                        .foregroundColor(a.isSelected ? course.color : .appTextSecondary)
                } else if let notes = a.notes, !notes.isEmpty {
                    Text(notes)
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                        .lineLimit(1)
                } else {
                    Text("No due date")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.xs)
        .contentShape(Rectangle())
        .onTapGesture { assignments[i].isSelected.toggle() }
    }

    // MARK: - Error view

    private func errorView(_ message: String) -> some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 52))
                .foregroundColor(.appPriorityHigh)
            VStack(spacing: AppSpacing.sm) {
                Text("Something went wrong")
                    .font(.appTitle)
                    .foregroundColor(.appTextPrimary)
                Text(message)
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xl)
            }
            Button("Try Again") { uploadState = .idle }
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.black)
                .padding(.horizontal, AppSpacing.xl)
                .padding(.vertical, AppSpacing.sm)
                .background(course.color)
                .cornerRadius(AppRadius.md)
            Spacer()
        }
    }

    // MARK: - Load helpers

    @MainActor
    private func loadPhoto(_ item: PhotosPickerItem) async {
        uploadState = .parsing
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                uploadState = .error("Could not read image data.")
                return
            }
            // Try to detect format; fall back to JPEG
            let mime = imageType(data: data)
            let result = try await AnthropicService.shared.parseSyllabus(imageData: data, mimeType: mime)
            assignments   = result
            uploadState   = .results
        } catch {
            uploadState = .error(error.localizedDescription)
        }
    }

    @MainActor
    private func loadFile(_ result: Result<URL, Error>) async {
        uploadState = .parsing
        do {
            let url = try result.get()
            guard url.startAccessingSecurityScopedResource() else {
                uploadState = .error("Permission denied for the selected file.")
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            let data = try Data(contentsOf: url)
            guard let (imgData, mime) = AnthropicService.renderPDF(data) else {
                uploadState = .error("Could not render PDF pages. Make sure the file is a valid PDF.")
                return
            }
            let parsed = try await AnthropicService.shared.parseSyllabus(imageData: imgData, mimeType: mime)
            assignments  = parsed
            uploadState  = .results
        } catch {
            uploadState = .error(error.localizedDescription)
        }
    }

    /// Sniff the image type from its magic bytes (JPEG vs PNG vs HEIC fallback).
    private func imageType(data: Data) -> String {
        guard data.count > 3 else { return "image/jpeg" }
        let bytes = [data[0], data[1], data[2], data[3]]
        if bytes[0] == 0xFF && bytes[1] == 0xD8 { return "image/jpeg" }
        if bytes[0] == 0x89 && bytes[1] == 0x50 { return "image/png"  }
        return "image/jpeg" // HEIC and others → re-encode via UIImage below
    }

    // MARK: - Import

    private func importAssignments() {
        let selected = assignments.filter(\.isSelected)
        for a in selected {
            let newTask = Task(
                title:    a.title,
                notes:    a.notes ?? "",
                dueDate:  a.dueDate,
                priority: .medium,
                category: .school
            )
            context.insert(newTask)
            newTask.course = course
            course.assignments.append(newTask)
            NotificationService.shared.schedule(for: newTask)
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}
