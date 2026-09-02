import SwiftUI

struct SpeakersView: View {
    @EnvironmentObject var vm: AppViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Speakers")
                    .font(.largeTitle).fontWeight(.bold)
                    .padding(.horizontal, 16)

                LazyVGrid(columns: [
                    GridItem(.adaptive(minimum: 160), spacing: 16)
                ], spacing: 16) {
                    ForEach(vm.uniqueSpeakers, id: \.id) { speaker in
                        Button {
                            vm.currentPage = .speakerDetail(rabbi: speaker.id)
                        } label: {
                            VStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(Color(.tertiarySystemBackground))
                                        .frame(width: 80, height: 80)
                                    Image(systemName: speaker.id.lowercased().contains("guest") ? "person.3.fill" : "person.fill")
                                        .font(.system(size: 28))
                                        .foregroundStyle(.secondary)
                                }

                                VStack(spacing: 2) {
                                    Text(speaker.name)
                                        .font(.subheadline).fontWeight(.semibold)
                                        .foregroundStyle(.primary)
                                        .lineLimit(1)
                                    Text("\(speaker.shiurCount) Shiurim")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                            .padding(.horizontal, 12)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.top, 8)
            .padding(.bottom, 100)
        }
    }
}
