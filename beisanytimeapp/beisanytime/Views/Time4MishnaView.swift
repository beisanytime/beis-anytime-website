import SwiftUI

struct Time4MishnaView: View {
    @EnvironmentObject var vm: AppViewModel
    @EnvironmentObject var toast: ToastManager

    private var filtered: [Shiur] {
        vm.shiurimForTime4Mishna()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Time4Mishna")
                            .font(.largeTitle).fontWeight(.bold)
                        Text("\(filtered.count) Shiurim available")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        vm.currentPage = .upload
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.up.circle.fill")
                            Text("Upload")
                        }
                        .font(.subheadline).fontWeight(.semibold)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color.appAccent)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)

                if filtered.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "headphones")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("No Mishnayot Yet")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                } else {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 300), spacing: 20)
                    ], spacing: 20) {
                        ForEach(filtered) { shiur in
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
