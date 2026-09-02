import SwiftUI
import AVKit

struct ShiurPlayerView: View {
    @EnvironmentObject var vm: AppViewModel
    @EnvironmentObject var toast: ToastManager
    let shiurId: String

    @State private var shiur: Shiur?
    @State private var isLoading = true
    @State private var showShareSheet = false
    @State private var showComments = true

    // Player state
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var currentTime: Double = 0
    @State private var duration: Double = 0
    @State private var playbackSpeed: Double = 1.0
    @State private var seekValue: Double = 0
    @State private var isSeeking = false
    @State private var timeObserver: Any?

    // Social state
    @State private var likeCount = 0
    @State private var userLiked = false
    @State private var viewCount = 0
    @State private var comments: [Comment] = []
    @State private var commentText = ""
    @State private var isPostingComment = false

    // Related
    @State private var relatedShiurim: [Shiur] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 100)
                } else if let shiur {
                    // Back button
                    HStack {
                        Button {
                            cleanupPlayer()
                            vm.currentPage = .home
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "chevron.left")
                                Text("Back")
                            }
                            .font(.subheadline).fontWeight(.medium)
                        }
                        Spacer()
                        Button { showShareSheet = true } label: {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 12)

                    // Video/Audio Player
                    playerSection(shiur: shiur)

                    // Details
                    VStack(alignment: .leading, spacing: 16) {
                        Text(shiur.title)
                            .font(.title2).fontWeight(.bold)

                        // Meta row
                        HStack(spacing: 12) {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(Color(hex: shiur.rabbiColorHex.replacingOccurrences(of: "#", with: "")))
                                    .frame(width: 10, height: 10)
                                Text(shiur.rabbiDisplayName)
                                    .font(.subheadline).fontWeight(.semibold)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(Capsule())

                            let date = shiur.dateDisplay
                            if !date.isEmpty {
                                Text(date)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if viewCount > 0 {
                                HStack(spacing: 4) {
                                    Image(systemName: "eye")
                                    Text("\(viewCount)")
                                }
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }

                            Spacer()

                            // Like button
                            Button {
                                Task { await toggleLike() }
                            } label: {
                                HStack(spacing: 4) {
                                    Image(systemName: userLiked ? "hand.thumbsup.fill" : "hand.thumbsup")
                                    Text("\(likeCount)")
                                }
                                .font(.subheadline)
                                .foregroundStyle(userLiked ? Color.appAccent : .secondary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color(.tertiarySystemBackground))
                                .clipShape(Capsule())
                            }
                        }

                        // Description
                        if let desc = shiur.description, !desc.isEmpty {
                            Text(desc)
                                .font(.body)
                                .foregroundStyle(.primary.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        // Tags
                        if let tags = shiur.tags, !tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(tags, id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 5)
                                            .background(Color(.tertiarySystemBackground))
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                        }

                        // Speed controls
                        if !shiur.isTime4Mishna {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Playback Speed")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.secondary)
                                HStack(spacing: 10) {
                                    ForEach([1.0, 1.25, 1.5, 2.0], id: \.self) { speed in
                                        Button {
                                            playbackSpeed = speed
                                            player?.rate = Float(speed)
                                        } label: {
                                            Text(speed == 1.0 ? "1x" : "\(speed, specifier: "%.2g")x")
                                                .font(.caption)
                                                .fontWeight(.semibold)
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 8)
                                                .background(playbackSpeed == speed ? Color.appAccent : Color(.tertiarySystemBackground))
                                                .foregroundStyle(playbackSpeed == speed ? .white : .primary)
                                                .clipShape(Capsule())
                                        }
                                    }
                                }
                            }
                            .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                    Divider()
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)

                    // Comments
                    commentsSection

                    // Related
                    if !relatedShiurim.isEmpty {
                        Divider()
                            .padding(.horizontal, 16)
                            .padding(.vertical, 16)

                        VStack(alignment: .leading, spacing: 16) {
                            Text("Up Next")
                                .font(.title3).fontWeight(.bold)
                                .padding(.horizontal, 16)

                            ForEach(relatedShiurim) { related in
                                Button {
                                    cleanupPlayer()
                                    vm.currentPage = .viewShiur(id: related.id)
                                } label: {
                                    HStack(spacing: 12) {
                                        AsyncImage(url: related.thumbnailURL) { image in
                                            image.resizable().aspectRatio(16/9, contentMode: .fill)
                                        } placeholder: {
                                            Rectangle().fill(Color(.tertiarySystemBackground))
                                        }
                                        .frame(width: 140, height: 79)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))

                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(related.title)
                                                .font(.subheadline).fontWeight(.semibold)
                                                .lineLimit(2)
                                                .foregroundStyle(.primary)
                                                .multilineTextAlignment(.leading)
                                            Text(related.rabbiDisplayName)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                    }
                                    .padding(.horizontal, 16)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.bottom, 100)
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .task { await loadShiur() }
        .sheet(isPresented: $showShareSheet) {
            if let url = URL(string: "https://beisanytime.com/#view_shiur/\(shiurId)") {
                ShareSheet(items: [url])
            }
        }
        .onDisappear { cleanupPlayer() }
    }

    // MARK: - Player Section
    @ViewBuilder
    private func playerSection(shiur: Shiur) -> some View {
        if shiur.isTime4Mishna {
            // Audio player
            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color(hex: "1e293b"))
                        .frame(width: 120, height: 120)
                        .shadow(radius: 10)
                    Image(systemName: isPlaying ? "pause.fill" : "headphones")
                        .font(.system(size: 40))
                        .foregroundStyle(.white)
                }
                .onTapGesture {
                    togglePlayPause()
                }

                Text(shiur.title)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)

                Text("Time4Mishna")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
                    .fontWeight(.semibold)

                if let player {
                    VStack(spacing: 8) {
                        Slider(value: $seekValue, in: 0...max(duration, 1)) { editing in
                            isSeeking = editing
                            if !editing {
                                let time = CMTime(seconds: seekValue, preferredTimescale: 600)
                                player.seek(to: time)
                            }
                        }
                        .tint(.appAccent)

                        HStack {
                            Text(formatTime(seekValue))
                                .font(.caption).monospacedDigit()
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(formatTime(duration))
                                .font(.caption).monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 20)

                    HStack(spacing: 40) {
                        Button { skipBackward() } label: {
                            Image(systemName: "gobackward.15")
                                .font(.title3)
                        }
                        Button { togglePlayPause() } label: {
                            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                                .font(.system(size: 56))
                        }
                        Button { skipForward() } label: {
                            Image(systemName: "goforward.15")
                                .font(.title3)
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 30)
            .background(
                LinearGradient(
                    colors: [Color(hex: "1e293b"), Color(hex: "0f172a")],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 16)
        } else {
            // Video player
            Group {
                if let player {
                    VideoPlayerView(player: player)
                        .aspectRatio(16/9, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(alignment: .bottom) {
                            // Custom controls overlay
                            VStack {
                                Spacer()
                                HStack {
                                    Button { togglePlayPause() } label: {
                                        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                            .font(.title3)
                                            .foregroundStyle(.white)
                                            .padding(10)
                                            .background(.ultraThinMaterial)
                                            .clipShape(Circle())
                                    }
                                    Text("\(formatTime(seekValue)) / \(formatTime(duration))")
                                        .font(.caption)
                                        .monospacedDigit()
                                        .foregroundStyle(.white)
                                    Spacer()
                                }
                                .padding(12)
                            }
                        }
                } else {
                    Rectangle()
                        .fill(Color.black)
                        .aspectRatio(16/9, contentMode: .fit)
                        .overlay { ProgressView().tint(.white) }
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Comments Section
    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Comments")
                .font(.title3).fontWeight(.bold)
                .padding(.horizontal, 16)

            // Comment input
            if let user = vm.currentUser {
                HStack(alignment: .top, spacing: 12) {
                    AsyncImage(url: URL(string: user.picture)) { image in
                        image.resizable().clipShape(Circle())
                    } placeholder: {
                        Circle().fill(Color.gray.opacity(0.3))
                    }
                    .frame(width: 36, height: 36)

                    VStack(spacing: 8) {
                        TextField("Add a comment...", text: $commentText, axis: .vertical)
                            .textFieldStyle(.plain)
                            .lineLimit(2...5)
                            .padding(10)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        HStack {
                            Spacer()
                            Button {
                                Task { await postComment() }
                            } label: {
                                if isPostingComment {
                                    ProgressView().scaleEffect(0.8)
                                } else {
                                    Text("Post Comment")
                                        .font(.subheadline).fontWeight(.semibold)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(commentText.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.appAccent)
                                        .foregroundStyle(.white)
                                        .clipShape(Capsule())
                                }
                            }
                            .disabled(commentText.trimmingCharacters(in: .whitespaces).isEmpty || isPostingComment)
                        }
                    }
                }
                .padding(.horizontal, 16)
            } else {
                VStack(spacing: 12) {
                    Text("Sign in to join the conversation.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
            }

            // Comments list
            if comments.isEmpty {
                Text("No comments yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
            } else {
                ForEach(comments) { comment in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(comment.displayName ?? comment.email)
                                .font(.subheadline).fontWeight(.bold)
                            Spacer()
                            Text(comment.formattedDate)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(comment.text)
                            .font(.body)

                        if let user = vm.currentUser, vm.isAdmin {
                            Button("Delete", role: .destructive) {
                                Task { await deleteComment(comment) }
                            }
                            .font(.caption2)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, 16)
                }
            }
        }
        .padding(.bottom, 100)
    }

    // MARK: - Actions
    private func loadShiur() async {
        isLoading = true
        guard let loaded = await vm.loadShiur(id: shiurId) else {
            isLoading = false
            return
        }
        shiur = loaded
        isLoading = false

        // Set up player
        if let urlString = loaded.playbackUrl, let url = URL(string: urlString) {
            let avPlayer = AVPlayer(url: url)
            self.player = avPlayer
            setupTimeObserver(avPlayer: avPlayer)

            // Resume from saved position
            let savedTime = UserDefaults.standard.double(forKey: "vid_progress_\(shiurId)")
            if savedTime > 0 {
                await avPlayer.seek(to: CMTime(seconds: savedTime, preferredTimescale: 600))
            }
        }

        // Load social data concurrently
        async let viewsTask: () = loadViews()
        async let likesTask: () = loadLikes()
        async let commentsTask: () = loadComments()
        async let relatedTask: () = loadRelated()
        _ = await (viewsTask, likesTask, commentsTask, relatedTask)
    }

    private func setupTimeObserver(avPlayer: AVPlayer) {
        let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
        timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { time in
            let t = time.seconds
            let d = avPlayer.currentItem?.duration.seconds ?? 0
            self.currentTime = t.isFinite ? t : 0
            self.duration = d.isFinite ? d : 0
            if !isSeeking {
                seekValue = currentTime
            }
            // Save progress
            vm.saveProgress(id: shiurId, time: currentTime, duration: duration)
        }
    }

    private func togglePlayPause() {
        guard let player else { return }
        if isPlaying {
            player.pause()
        } else {
            player.play()
            player.rate = Float(playbackSpeed)
        }
        isPlaying.toggle()
    }

    private func skipForward() {
        guard let player else { return }
        let newTime = min(currentTime + 15, duration)
        player.seek(to: CMTime(seconds: newTime, preferredTimescale: 600))
    }

    private func skipBackward() {
        guard let player else { return }
        let newTime = max(currentTime - 15, 0)
        player.seek(to: CMTime(seconds: newTime, preferredTimescale: 600))
    }

    private func cleanupPlayer() {
        if let observer = timeObserver, let player {
            player.removeTimeObserver(observer)
        }
        player?.pause()
        player = nil
        timeObserver = nil
        isPlaying = false
    }

    private func loadViews() async {
        do {
            let res = try await APIClient.shared.getViews(shiurId: shiurId)
            viewCount = res.count
        } catch {}
        await APIClient.shared.incrementViews(shiurId: shiurId)
    }

    private func loadLikes() async {
        do {
            let res = try await APIClient.shared.getLikes(shiurId: shiurId)
            likeCount = res.count
            userLiked = res.userLiked ?? false
        } catch {}
    }

    private func toggleLike() async {
        guard let email = vm.currentUser?.email else {
            toast.show("Please sign in", type: .error)
            return
        }
        do {
            try await APIClient.shared.toggleLike(shiurId: shiurId, email: email)
            await loadLikes()
        } catch {
            toast.show("Failed to like", type: .error)
        }
    }

    private func loadComments() async {
        do {
            let res = try await APIClient.shared.getComments(shiurId: shiurId)
            comments = res.comments
        } catch {}
    }

    private func postComment() async {
        guard let email = vm.currentUser?.email else { return }
        let text = commentText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        isPostingComment = true
        do {
            try await APIClient.shared.postComment(shiurId: shiurId, text: text, email: email)
            commentText = ""
            await loadComments()
        } catch {
            toast.show("Failed to post comment", type: .error)
        }
        isPostingComment = false
    }

    private func deleteComment(_ comment: Comment) async {
        guard let email = vm.currentUser?.email else { return }
        do {
            try await APIClient.shared.deleteComment(shiurId: shiurId, commentId: comment.id, email: email)
            await loadComments()
        } catch {}
    }

    private func loadRelated() async {
        guard let shiur else { return }
        relatedShiurim = vm.allShiurim
            .filter { $0.id != shiurId }
            .sorted { ($0.rabbi == shiur.rabbi ? 0 : 1) < ($1.rabbi == shiur.rabbi ? 0 : 1) }
            .prefix(8)
            .map { $0 }
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite && seconds >= 0 else { return "0:00" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

// MARK: - AVKit Video Player UIViewRepresentable
struct VideoPlayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> VideoPlayerUIView {
        let view = VideoPlayerUIView()
        view.player = player
        return view
    }

    func updateUIView(_ uiView: VideoPlayerUIView, context: Context) {}
}

class VideoPlayerUIView: UIView {
    var player: AVPlayer? {
        didSet {
            playerLayer?.player = player
        }
    }
    private var playerLayer: AVPlayerLayer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        let layer = AVPlayerLayer()
        layer.videoGravity = .resizeAspect
        layer.masksToBounds = true
        self.layer.addSublayer(layer)
        self.playerLayer = layer
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
    }
}

// MARK: - Share Sheet
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
