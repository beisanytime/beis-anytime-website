import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct UploadView: View {
    @EnvironmentObject var vm: AppViewModel
    @EnvironmentObject var toast: ToastManager

    @State private var title = ""
    @State private var rabbi = ""
    @State private var date = Date()
    @State private var selectedFile: URL?
    @State private var fileName = ""
    @State private var isUploading = false
    @State private var uploadProgress: Double = 0
    @State private var showingFilePicker = false
    @State private var existingRabbis: [String] = []

    var isTime4Mishna: Bool {
        rabbi.lowercased() == "time4mishna"
    }

    var acceptedTypes: [UTType] {
        if rabbi.lowercased() == "time4mishna" {
            return [.audio]
        }
        return [.movie, .audio]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Upload Shiur")
                    .font(.largeTitle).fontWeight(.bold)
                    .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 16) {
                    // Speaker
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Speaker")
                            .font(.subheadline).fontWeight(.semibold)
                        TextField("e.g. Rabbi Hartman", text: $rabbi)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        if !existingRabbis.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(existingRabbis, id: \.self) { r in
                                        Button { rabbi = r } label: {
                                            Text(r.replacingOccurrences(of: "_", with: " ").capitalized)
                                                .font(.caption)
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 5)
                                                .background(rabbi == r ? Color.appAccent.opacity(0.2) : Color(.tertiarySystemBackground))
                                                .foregroundStyle(rabbi == r ? Color.appAccent : .primary)
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Title
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Title")
                            .font(.subheadline).fontWeight(.semibold)
                        TextField("Shiur title", text: $title)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    // Date
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Date")
                            .font(.subheadline).fontWeight(.semibold)
                        DatePicker("Date", selection: $date, displayedComponents: .date)
                            .labelsHidden()
                    }

                    // File picker
                    VStack(alignment: .leading, spacing: 6) {
                        Text(isTime4Mishna ? "Audio File" : "File")
                            .font(.subheadline).fontWeight(.semibold)
                        Button {
                            showingFilePicker = true
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: selectedFile != nil ? "checkmark.circle.fill" : "doc.badge.plus")
                                    .foregroundStyle(selectedFile != nil ? Color.appSuccess : .secondary)
                                Text(selectedFile != nil ? fileName : "Select file")
                                    .foregroundStyle(selectedFile != nil ? .primary : .secondary)
                                Spacer()
                            }
                            .padding(12)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }

                    // Upload button
                    if isUploading {
                        VStack(spacing: 8) {
                            ProgressView(value: uploadProgress)
                                .tint(.appAccent)
                            Text("Uploading...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        Button {
                            Task { await performUpload() }
                        } label: {
                            Text("Upload")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(canUpload ? Color.appAccent : Color.gray)
                                .foregroundStyle(.white)
                                .clipShape(Capsule())
                        }
                        .disabled(!canUpload)
                    }
                }
                .padding(16)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 16)
            }
            .padding(.top, 8)
            .padding(.bottom, 100)
        }
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: acceptedTypes
        ) { result in
            if case .success(let url) = result {
                selectedFile = url
                fileName = url.lastPathComponent
            }
        }
        .task {
            await loadExistingRabbis()
        }
    }

    private var canUpload: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        !rabbi.trimmingCharacters(in: .whitespaces).isEmpty &&
        selectedFile != nil
    }

    private func loadExistingRabbis() async {
        existingRabbis = Set(vm.allShiurim.compactMap { $0.rabbi })
            .filter { $0.lowercased() != "time4mishna" }
            .sorted()
    }

    private func performUpload() async {
        guard let fileURL = selectedFile else { return }
        isUploading = true
        uploadProgress = 0.1
        defer { isUploading = false }

        do {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let dateStr = formatter.string(from: date)

            let rabbiValue = rabbi.lowercased() == "time4mishna" ? "time4mishna" : rabbi

            // Step 1: Prepare upload
            let prepBody: [String: Any] = [
                "title": title.trimmingCharacters(in: .whitespaces),
                "rabbi": rabbiValue,
                "date": dateStr,
                "fileName": fileURL.lastPathComponent
            ]
            let prepData = try JSONSerialization.data(withJSONObject: prepBody)

            var prepRequest = URLRequest(url: URL(string: "\(APIConfig.mainAPI)/api/admin/prepare-upload")!)
            prepRequest.httpMethod = "POST"
            prepRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            prepRequest.httpBody = prepData

            let (prepRespData, _) = try await URLSession.shared.data(for: prepRequest)
            guard let prepResp = try JSONSerialization.jsonObject(with: prepRespData) as? [String: Any],
                  let r2Key = prepResp["r2Key"] as? String,
                  let uploadId = prepResp["uploadId"] as? String else {
                throw UploadError.prepareFailed
            }

            uploadProgress = 0.2

            // Step 2: Upload file in chunks
            let fileData = try Data(contentsOf: fileURL)
            let chunkSize = 10 * 1024 * 1024 // 10MB
            let totalParts = max(1, Int(ceil(Double(fileData.count) / Double(chunkSize))))
            var uploadedParts: [[String: Any]] = []

            for partIndex in 0..<totalParts {
                let start = partIndex * chunkSize
                let end = min(start + chunkSize, fileData.count)
                let chunk = fileData.subdata(in: start..<end)
                let partNumber = partIndex + 1

                uploadProgress = 0.2 + (Double(partIndex) / Double(totalParts)) * 0.6

                let partURLString = "\(APIConfig.mainAPI)/api/admin/upload-part?key=\(r2Key)&uploadId=\(uploadId)&partNumber=\(partNumber)"
                var partRequest = URLRequest(url: URL(string: partURLString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? partURLString)!)
                partRequest.httpMethod = "PUT"
                partRequest.httpBody = chunk

                let (partRespData, _) = try await URLSession.shared.data(for: partRequest)
                guard let partResp = try JSONSerialization.jsonObject(with: partRespData) as? [String: Any],
                      let etag = partResp["etag"] as? String else {
                    throw UploadError.uploadFailed
                }
                uploadedParts.append(["partNumber": partNumber, "etag": etag])
            }

            uploadProgress = 0.85

            // Step 3: Complete upload
            let completeBody: [String: Any] = [
                "r2Key": r2Key,
                "uploadId": uploadId,
                "parts": uploadedParts
            ]
            let completeData = try JSONSerialization.data(withJSONObject: completeBody)

            var completeRequest = URLRequest(url: URL(string: "\(APIConfig.mainAPI)/api/admin/complete-upload")!)
            completeRequest.httpMethod = "POST"
            completeRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            completeRequest.httpBody = completeData

            let (completeRespData, _) = try await URLSession.shared.data(for: completeRequest)
            guard let completeRespDict = try JSONSerialization.jsonObject(with: completeRespData) as? [String: Any],
                  completeRespDict["error"] == nil else {
                throw UploadError.completeFailed
            }

            uploadProgress = 1.0

            // Clear cache and refresh
            vm.invalidateCache()
            await vm.loadAllShiurim()

            toast.show("Uploaded successfully!")
            title = ""
            rabbi = ""
            selectedFile = nil
            fileName = ""
            vm.currentPage = isTime4Mishna ? .time4mishna : .home

        } catch {
            toast.show("Upload failed: \(error.localizedDescription)", type: .error)
        }
    }

    enum UploadError: LocalizedError {
        case prepareFailed, uploadFailed, completeFailed

        var errorDescription: String? {
            switch self {
            case .prepareFailed: return "Failed to prepare upload"
            case .uploadFailed: return "Failed to upload file"
            case .completeFailed: return "Failed to finalize upload"
            }
        }
    }
}
