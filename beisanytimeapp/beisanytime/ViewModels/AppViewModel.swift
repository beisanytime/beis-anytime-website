import Foundation
import SwiftUI
import Combine

// MARK: - User Profile
struct UserProfile: Codable {
    let name: String
    let email: String
    let picture: String
}

// MARK: - Navigation
enum AppPage: Hashable {
    case home
    case browse
    case community
    case speakers
    case bookmarks
    case time4mishna
    case speakerDetail(rabbi: String)
    case viewShiur(id: String)
    case upload
}

// MARK: - App View Model
@MainActor
final class AppViewModel: ObservableObject {
    // State
    @Published var currentPage: AppPage = .home
    @Published var allShiurim: [Shiur] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var searchText = ""

    // Auth
    @Published var currentUser: UserProfile?
    @Published var isAdmin = false

    // Theme
    @Published var isDarkMode = false {
        didSet {
            UserDefaults.standard.set(isDarkMode, forKey: "theme")
        }
    }

    // Bookmarks
    @Published var bookmarkedIds: Set<String> = [] {
        didSet {
            UserDefaults.standard.set(Array(bookmarkedIds), forKey: "bookmarks")
        }
    }

    // Playback progress
    @Published var playbackProgress: [String: Double] = [:]
    @Published var playbackDuration: [String: Double] = [:]

    private let api = APIClient.shared

    init() {
        isDarkMode = UserDefaults.standard.bool(forKey: "theme")
        if let saved = UserDefaults.standard.array(forKey: "bookmarks") as? [String] {
            bookmarkedIds = Set(saved)
        }
        if let userData = UserDefaults.standard.data(forKey: "googleUser"),
           let user = try? JSONDecoder().decode(UserProfile.self, from: userData) {
            currentUser = user
            checkAdmin()
        }
    }

    // MARK: - Data Loading
    func loadAllShiurim() async {
        isLoading = true
        defer { isLoading = false }
        do {
            allShiurim = try await api.getAllShiurim()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadShiur(id: String) async -> Shiur? {
        do {
            let shiur = try await api.getShiur(id: id)
            if let idx = allShiurim.firstIndex(where: { $0.id == id }) {
                allShiurim[idx] = shiur
            }
            return shiur
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    // MARK: - Bookmarks
    func toggleBookmark(_ id: String) {
        if bookmarkedIds.contains(id) {
            bookmarkedIds.remove(id)
        } else {
            bookmarkedIds.insert(id)
        }
    }

    func isBookmarked(_ id: String) -> Bool {
        bookmarkedIds.contains(id)
    }

    // MARK: - Playback Progress
    func saveProgress(id: String, time: TimeInterval, duration: TimeInterval) {
        playbackProgress[id] = time
        playbackDuration[id] = duration
        UserDefaults.standard.set(time, forKey: "vid_progress_\(id)")
        UserDefaults.standard.set(duration, forKey: "vid_duration_\(id)")
    }

    func getProgress(id: String) -> Double {
        let prog = playbackProgress[id] ?? UserDefaults.standard.double(forKey: "vid_progress_\(id)")
        let dur = playbackDuration[id] ?? UserDefaults.standard.double(forKey: "vid_duration_\(id)")
        guard dur > 0, prog > 10, prog < dur - 10 else { return 0 }
        return prog / dur
    }

    func getContinueWatching() -> [Shiur] {
        allShiurim.filter { getProgress(id: $0.id) > 0 }.prefix(5).map { $0 }
    }

    // MARK: - Search
    var filteredShiurim: [Shiur] {
        guard !searchText.isEmpty else { return allShiurim }
        let q = searchText.lowercased()
        return allShiurim.filter {
            ($0.title.lowercased().contains(q)) ||
            ($0.rabbi?.lowercased().contains(q) == true) ||
            ($0.description?.lowercased().contains(q) == true)
        }
    }

    // MARK: - Auth
    func signIn(user: UserProfile) {
        currentUser = user
        let data = try? JSONEncoder().encode(user)
        UserDefaults.standard.set(data, forKey: "googleUser")
        checkAdmin()
    }

    func signOut() {
        currentUser = nil
        isAdmin = false
        UserDefaults.standard.removeObject(forKey: "googleUser")
    }

    private func checkAdmin() {
        let adminEmails = ["beisanytime@gmail.com", "joshuacalvert1@gmail.com"]
        isAdmin = currentUser.map { adminEmails.contains($0.email) } ?? false
    }

    // MARK: - Speakers
    var uniqueSpeakers: [(id: String, name: String, shiurCount: Int)] {
        var map: [String: (name: String, count: Int)] = [:]
        for s in allShiurim {
            guard let rabbi = s.rabbi, rabbi.lowercased() != "time4mishna" else { continue }
            let key = rabbi.lowercased().replacingOccurrences(of: "_", with: " ")
            if map[key] == nil {
                map[key] = (s.rabbiDisplayName, 1)
            } else {
                map[key]!.count += 1
            }
        }
        return map.map { (id: $0.key, name: $0.value.name, shiurCount: $0.value.count) }
            .sorted { $0.name < $1.name }
    }

    func shiurimForRabbi(_ rabbi: String) -> [Shiur] {
        let normalized = rabbi.lowercased().replacingOccurrences(of: "_", with: " ")
        return allShiurim.filter {
            $0.rabbi?.lowercased().replacingOccurrences(of: "_", with: " ") == normalized
        }
    }

    func shiurimForTime4Mishna() -> [Shiur] {
        allShiurim.filter { $0.rabbi?.lowercased() == "time4mishna" }
    }

    // MARK: - Cache
    func invalidateCache() {
        allShiurim = []
        Task {
            await api.invalidateCache()
        }
    }
}
