import Foundation

struct Post: Identifiable, Codable {
    let id: Int
    let content: String
    let displayName: String
    let avatarUrl: String
    let createdAt: Double

    var formattedDate: String {
        let date = Date(timeIntervalSince1970: createdAt)
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    enum CodingKeys: String, CodingKey {
        case id, content
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }
}

struct Comment: Identifiable, Codable {
    let id: String
    let text: String
    let email: String
    let displayName: String?
    let createdAt: Double

    var formattedDate: String {
        let date = Date(timeIntervalSince1970: createdAt / 1000)
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    enum CodingKeys: String, CodingKey {
        case id, text, email
        case displayName = "displayName"
        case createdAt = "createdAt"
    }
}

struct CommentResponse: Codable {
    let comments: [Comment]
}

struct LikesResponse: Codable {
    let count: Int
    let userLiked: Bool?
}

struct ViewsResponse: Codable {
    let count: Int
}
