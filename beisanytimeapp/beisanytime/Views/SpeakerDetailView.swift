import SwiftUI

struct SpeakerDetailView: View {
    @EnvironmentObject var vm: AppViewModel
    let rabbi: String

    var filtered: [Shiur] {
        vm.shiurimForRabbi(rabbi)
    }

    var displayName: String {
        filtered.first?.rabbiDisplayName ?? rabbi
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(.largeTitle).fontWeight(.bold)
                    Text("\(filtered.count) Shiurim available")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 16)

                LazyVGrid(columns: [
                    GridItem(.adaptive(minimum: 300), spacing: 20)
                ], spacing: 20) {
                    ForEach(filtered) { shiur in
                        VideoCardView(shiur: shiur)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 8)
            .padding(.bottom, 100)
        }
    }
}
