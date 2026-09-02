import SwiftUI

struct BottomNavView: View {
    @EnvironmentObject var vm: AppViewModel

    private let tabs: [(page: AppPage, icon: String, label: String)] = [
        (.home, "house.fill", "Home"),
        (.browse, "safari.fill", "Browse"),
        (.community, "person.3.fill", "Feed"),
        (.bookmarks, "bookmark.fill", "Later"),
        (.time4mishna, "clock.fill", "Mishna")
    ]

    var body: some View {
        VStack {
            Spacer()
            HStack(spacing: 0) {
                ForEach(tabs, id: \.label) { tab in
                    Button {
                        vm.currentPage = tab.page
                    } label: {
                        VStack(spacing: 4) {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: tab.icon)
                                    .font(.system(size: 22))
                                // Community badge
                                if tab.page == .community {
                                    Circle()
                                        .fill(Color(hex: "F59E0B"))
                                        .frame(width: 8, height: 8)
                                        .offset(x: 6, y: -2)
                                }
                            }
                            Text(tab.label)
                                .font(.caption2)
                                .fontWeight(vm.currentPage == tab.page ? .semibold : .regular)
                        }
                        .foregroundStyle(vm.currentPage == tab.page ? Color.appAccent : .secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 8)
            .padding(.bottom, 20)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) {
                Divider()
            }
        }
        .ignoresSafeArea(.keyboard)
    }
}
