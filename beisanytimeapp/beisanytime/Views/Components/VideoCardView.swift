import SwiftUI

struct VideoCardView: View {
    @EnvironmentObject var vm: AppViewModel
    let shiur: Shiur
    var showBookmark = true

    var body: some View {
        Button {
            vm.currentPage = .viewShiur(id: shiur.id)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Thumbnail
                ZStack(alignment: .bottomLeading) {
                    AsyncImage(url: shiur.thumbnailURL) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(16/9, contentMode: .fill)
                        case .failure:
                            Rectangle()
                                .fill(Color.gray.opacity(0.2))
                                .aspectRatio(16/9, contentMode: .fill)
                                .overlay {
                                    Image(systemName: "photo")
                                        .foregroundStyle(.gray)
                                }
                        case .empty:
                            Rectangle()
                                .fill(Color.gray.opacity(0.1))
                                .aspectRatio(16/9, contentMode: .fill)
                                .overlay { ProgressView() }
                        @unknown default:
                            Rectangle().fill(Color.gray.opacity(0.1)).aspectRatio(16/9, contentMode: .fill)
                        }
                    }
                    .clipped()

                    // Rabbi badge
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color(hex: shiur.rabbiColorHex.replacingOccurrences(of: "#", with: "")))
                            .frame(width: 8, height: 8)
                            .shadow(color: Color(hex: shiur.rabbiColorHex.replacingOccurrences(of: "#", with: "")).opacity(0.6), radius: 4)
                        Text(shiur.rabbiDisplayName)
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .padding(12)

                    // Progress bar
                    let progress = vm.getProgress(id: shiur.id)
                    if progress > 0 {
                        VStack {
                            Spacer()
                            GeometryReader { geo in
                                Rectangle()
                                    .fill(Color.red)
                                    .frame(width: geo.size.width * progress, height: 4)
                                    .shadow(color: .red, radius: 6)
                            }
                            .frame(height: 4)
                        }
                    }

                    // Bookmark button
                    if showBookmark {
                        VStack {
                            HStack {
                                Spacer()
                                Button {
                                    vm.toggleBookmark(shiur.id)
                                } label: {
                                    Image(systemName: vm.isBookmarked(shiur.id) ? "bookmark.fill" : "bookmark")
                                        .foregroundStyle(vm.isBookmarked(shiur.id) ? Color.appAccent : .white)
                                        .font(.system(size: 14))
                                        .padding(8)
                                        .background(.ultraThinMaterial)
                                        .clipShape(Circle())
                                }
                            }
                            Spacer()
                        }
                        .padding(12)
                    }
                }
                .aspectRatio(16/9, contentMode: .fit)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 12, topTrailingRadius: 12))

                // Card content
                VStack(alignment: .leading, spacing: 6) {
                    Text(shiur.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(2)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)

                    if let tags = shiur.tags, !tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(tags, id: \.self) { tag in
                                    Text(tag)
                                        .font(.caption2)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color(.systemGray5))
                                        .clipShape(Capsule())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    let date = shiur.dateDisplay
                    if !date.isEmpty {
                        Text(date)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
    }
}
