import SwiftUI

struct BookmarksView: View {
    @EnvironmentObject var vm: AppViewModel

    var bookmarkedShiurim: [Shiur] {
        vm.allShiurim.filter { vm.isBookmarked($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Watch Later")
                    .font(.largeTitle).fontWeight(.bold)
                    .padding(.horizontal, 16)

                if bookmarkedShiurim.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "bookmark")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("No Saved Shiurim")
                            .font(.headline)
                        Text("Bookmark shiurim to watch later")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 300), spacing: 20)
                    ], spacing: 20) {
                        ForEach(bookmarkedShiurim) { shiur in
                            VideoCardView(shiur: shiur)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 100)
        }
    }
}
