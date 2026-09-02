import Foundation

// MARK: - API Configuration
enum APIConfig {
    static let mainAPI = "https://beis-api.beisanytime.workers.dev"
    static let communityAPI = "https://beis-social-worker.beisanytime.workers.dev"
    static let videoAPI = "https://beis-anytime-viewsapi.beisanytime.workers.dev"
}

// MARK: - API Client
final class APIClient: Sendable {
    static let shared = APIClient()

    private let session: URLSession
    private var shiurCache: [Shiur] = []

    private init() {
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .reloadRevalidatingCacheData
        session = URLSession(configuration: config)
    }

    // MARK: - Generic Fetch
    private func performFetch<T: Decodable>(from urlString: String, method: String = "GET", headers: [String: String]? = nil, body: Data? = nil) async throws -> T {
        guard let url = URL(string: urlString) else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30

        if let headers = headers {
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        if let body = body {
            request.httpBody = body
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 204 { throw APIError.noContent }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Shiurim
    func getAllShiurim() async throws -> [Shiur] {
        if !shiurCache.isEmpty { return shiurCache }

        var request = URLRequest(url: URL(string: "\(APIConfig.mainAPI)/api/all-shiurim")!)
        request.cachePolicy = .reloadIgnoringLocalCacheData

        let (data, _) = try await session.data(for: request)
        var shiurim = try JSONDecoder().decode([Shiur].self, from: data)
        shiurim.sort { ($0.date ?? "") > ($1.date ?? "") }
        shiurCache = shiurim
        return shiurim
    }

    func getShiur(id: String) async throws -> Shiur {
        return try await performFetch(from: "\(APIConfig.mainAPI)/api/shiurim/id/\(id)")
    }

    func invalidateCache() {
        shiurCache = []
    }

    // MARK: - Community Posts
    func getPosts() async throws -> [Post] {
        return try await performFetch(from: "\(APIConfig.communityAPI)/api/posts")
    }

    func createPost(content: String, user: UserProfile) async throws {
        let payload: [String: Any] = [
            "content": content,
            "user": ["name": user.name, "email": user.email, "picture": user.picture]
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.communityAPI)/api/posts", method: "POST", headers: ["Content-Type": "application/json"], body: body)
    }

    func deletePost(id: Int, email: String) async throws {
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.communityAPI)/api/posts/\(id)", method: "DELETE", headers: ["X-User-Email": email])
    }

    // MARK: - Comments
    func getComments(shiurId: String) async throws -> CommentResponse {
        return try await performFetch(from: "\(APIConfig.videoAPI)/api/comments/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)")
    }

    func postComment(shiurId: String, text: String, email: String) async throws {
        let body = try JSONEncoder().encode(["text": text])
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.videoAPI)/api/comments/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)", method: "POST", headers: ["Content-Type": "application/json", "X-User-Email": email], body: body)
    }

    func deleteComment(shiurId: String, commentId: String, email: String) async throws {
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.videoAPI)/api/comments/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)/\(commentId)", method: "DELETE", headers: ["X-User-Email": email])
    }

    // MARK: - Likes
    func getLikes(shiurId: String) async throws -> LikesResponse {
        return try await performFetch(from: "\(APIConfig.videoAPI)/api/likes/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)")
    }

    func toggleLike(shiurId: String, email: String) async throws {
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.videoAPI)/api/likes/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)", method: "POST", headers: ["X-User-Email": email])
    }

    // MARK: - Views
    func getViews(shiurId: String) async throws -> ViewsResponse {
        return try await performFetch(from: "\(APIConfig.videoAPI)/api/views/\(shiurId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? shiurId)")
    }

    func incrementViews(shiurId: String) async {
        let _: EmptyResponse? = try? await performFetch(from: "\(APIConfig.videoAPI)/api/views/increment", method: "POST", headers: ["Content-Type": "application/json"], body: try? JSONEncoder().encode(["id": shiurId]))
    }
}

// MARK: - Errors
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case noContent
    case serverError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response from server"
        case .noContent: return "No content"
        case .serverError(let code): return "Server error: \(code)"
        }
    }
}

struct EmptyResponse: Codable {}
