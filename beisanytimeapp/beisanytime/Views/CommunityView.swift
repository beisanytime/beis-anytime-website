import SwiftUI

struct CommunityView: View {
    @EnvironmentObject var vm: AppViewModel
    @State private var posts: [Post] = []
    @State private var isLoading = true
    @State private var newPostText = ""
    @State private var isPosting = false
    @EnvironmentObject var toast: ToastManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    Text("Community Feed")
                        .font(.largeTitle).fontWeight(.bold)
                    Spacer()
                    Button {
                        Task { await loadPosts() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 16)

                // Admin post composer
                if vm.isAdmin, let user = vm.currentUser {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Post Announcement")
                            .font(.headline)
                        HStack(alignment: .top, spacing: 12) {
                            AsyncImage(url: URL(string: user.picture)) { image in
                                image.resizable().clipShape(Circle())
                            } placeholder: {
                                Circle().fill(Color.gray.opacity(0.3))
                            }
                            .frame(width: 40, height: 40)

                            TextEditor(text: $newPostText)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 60)
                                .font(.body)
                        }
                        HStack {
                            Spacer()
                            Button {
                                Task { await submitPost() }
                            } label: {
                                if isPosting {
                                    ProgressView()
                                } else {
                                    Text("Post")
                                        .fontWeight(.semibold)
                                        .padding(.horizontal, 20)
                                        .padding(.vertical, 8)
                                        .background(Color.appAccent)
                                        .foregroundStyle(.white)
                                        .clipShape(Capsule())
                                }
                            }
                            .disabled(newPostText.trimmingCharacters(in: .whitespaces).isEmpty || isPosting)
                        }
                    }
                    .padding(16)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 16)
                } else {
                    // Non-admin notice
                    HStack(spacing: 8) {
                        Image(systemName: "megaphone.fill")
                            .foregroundStyle(.secondary)
                        Text("Official Announcements and Updates")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(.horizontal, 16)
                }

                // Posts list
                if isLoading {
                    ForEach(0..<3) { _ in
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.tertiarySystemBackground))
                            .frame(height: 150)
                            .padding(.horizontal, 16)
                    }
                } else if posts.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "megaphone")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No Announcements Yet")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    ForEach(posts) { post in
                        PostCardView(post: post, isAdmin: vm.isAdmin, onDelete: {
                            Task { await deletePost(post) }
                        })
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 100)
        }
        .task { await loadPosts() }
    }

    private func loadPosts() async {
        isLoading = true
        do {
            posts = try await APIClient.shared.getPosts()
        } catch {
            toast.show("Failed to load posts", type: .error)
        }
        isLoading = false
    }

    private func submitPost() async {
        guard let user = vm.currentUser else { return }
        let text = newPostText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        isPosting = true
        do {
            try await APIClient.shared.createPost(content: text, user: user)
            newPostText = ""
            toast.show("Posted!")
            await loadPosts()
        } catch {
            toast.show("Failed to post", type: .error)
        }
        isPosting = false
    }

    private func deletePost(_ post: Post) async {
        guard let email = vm.currentUser?.email else { return }
        do {
            try await APIClient.shared.deletePost(id: post.id, email: email)
            toast.show("Post deleted")
            await loadPosts()
        } catch {
            toast.show("Failed to delete", type: .error)
        }
    }
}

// MARK: - Post Card
struct PostCardView: View {
    let post: Post
    let isAdmin: Bool
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                AsyncImage(url: URL(string: post.avatarUrl)) { image in
                    image.resizable().clipShape(Circle())
                } placeholder: {
                    Circle().fill(Color.gray.opacity(0.3))
                }
                .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(post.displayName)
                            .font(.subheadline).fontWeight(.bold)
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.appAccent)
                    }
                    Text(post.formattedDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(post.content)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)

            if isAdmin {
                HStack {
                    Spacer()
                    Button("Delete", role: .destructive) { onDelete() }
                        .font(.caption)
                }
            }
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
