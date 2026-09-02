import SwiftUI

struct BrowseView: View {
    @EnvironmentObject var vm: AppViewModel
    @State private var searchText = ""

    var filteredResults: [Shiur] {
        guard !searchText.isEmpty else { return vm.allShiurim }
        let q = searchText.lowercased()
        return vm.allShiurim.filter {
            ($0.title.lowercased().contains(q)) ||
            ($0.rabbi?.lowercased().contains(q) == true) ||
            ($0.description?.lowercased().contains(q) == true)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("All Shiurim")
                    .font(.largeTitle).fontWeight(.bold)
                    .padding(.horizontal, 16)

                // Search bar
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search shiurim...", text: $searchText)
                        .textFieldStyle(.plain)
                    if !searchText.isEmpty {
                        Button {
                            searchText = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(12)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)

                if filteredResults.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No Results Found")
                            .font(.headline)
                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 300), spacing: 20)
                    ], spacing: 20) {
                        ForEach(filteredResults) { shiur in
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
