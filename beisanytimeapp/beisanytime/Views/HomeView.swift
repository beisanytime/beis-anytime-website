import SwiftUI

struct HomeView: View {
    @EnvironmentObject var vm: AppViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Hero Card
                heroCard

                // Continue Watching
                let continuing = vm.getContinueWatching()
                if !continuing.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Continue Watching")
                            .font(.title2).fontWeight(.bold)
                            .padding(.horizontal, 16)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 16) {
                                ForEach(continuing) { shiur in
                                    VideoCardView(shiur: shiur)
                                        .frame(width: 260)
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                }

                // Latest Shiurim
                VStack(alignment: .leading, spacing: 16) {
                    Text("Latest Shiurim")
                        .font(.title2).fontWeight(.bold)
                        .padding(.horizontal, 16)

                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 300), spacing: 20)
                    ], spacing: 20) {
                        ForEach(vm.allShiurim.prefix(20)) { shiur in
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

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Torah Anytime, Anywhere.")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.primary, .secondary],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .lineLimit(2)

            Text("Explore a vast library of Shiurim from our esteemed Rabbis. Watch, listen, and grow.")
                .font(.body)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            Button {
                vm.currentPage = .browse
            } label: {
                Text("Browse Library")
                    .fontWeight(.semibold)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 14)
                    .background(Color.appAccent)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                    .shadow(color: Color.appAccent.opacity(0.3), radius: 8, y: 4)
            }
            .padding(.top, 4)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [
                    Color(.systemBackground),
                    Color(.secondarySystemBackground)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal, 16)
        .overlay(
            // Decorative circle
            Circle()
                .fill(Color.appAccent.opacity(0.05))
                .frame(width: 400, height: 400)
                .offset(x: 200, y: -100)
                .allowsHitTesting(false)
        )
    }
}
