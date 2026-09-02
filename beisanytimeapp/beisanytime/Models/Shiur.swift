import Foundation

struct Shiur: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let rabbi: String?
    let description: String?
    let date: String?
    let tags: [String]?
    let thumbnailUrl: String?
    let thumbnailDataUrl: String?
    var playbackUrl: String?

    var rabbiDisplayName: String {
        guard let rabbi = rabbi else { return "Unknown" }
        if rabbi.lowercased() == "guests" { return "Guest Speakers" }
        if rabbi.lowercased() == "time4mishna" { return "Time4Mishna" }
        return rabbi.replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }

    var dateDisplay: String {
        guard let date = date, let d = ISO8601DateFormatter().date(from: date) else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: d)
    }

    var isTime4Mishna: Bool {
        rabbi?.lowercased() == "time4mishna"
    }

    var thumbnailURL: URL? {
        let urlString = thumbnailDataUrl ?? thumbnailUrl ?? ""
        return URL(string: urlString)
    }

    var rabbiColorHex: String {
        switch rabbi?.lowercased() {
        case "rabbi_hartman", "rabbi hartman": return "#3B82F6"
        case "rabbi_rosenfeld", "rabbi rosenfeld": return "#22C55E"
        case "rabbi_golker", "rabbi golker": return "#F59E0B"
        case "guests": return "#A855F7"
        case "time4mishna": return "#F59E0B"
        default: return "#64748B"
        }
    }
}
