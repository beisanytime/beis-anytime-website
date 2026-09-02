import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vm: AppViewModel
    @State private var showSidebar = false

    var body: some View {
        ZStack(alignment: .leading) {
            // Main content
            NavigationStack(path: Binding(
                get: { [vm.currentPage] },
                set: { _ in }
            )) {
                mainContent
                    .navigationDestination(for: AppPage.self) { page in
                        destination(for: page)
                    }
            }
            .navigationTitle("")
            .navigationBarHidden(true)
            .onChange(of: vm.currentPage) { _, _ in
                showSidebar = false
            }

            // Mobile bottom nav
            BottomNavView()
                .environmentObject(vm)

            // Toast overlay
            ToastView()
        }
        .task {
            await vm.loadAllShiurim()
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        switch vm.currentPage {
        case .home:
            HomeView()
        case .browse:
            BrowseView()
        case .community:
            CommunityView()
        case .speakers:
            SpeakersView()
        case .bookmarks:
            BookmarksView()
        case .time4mishna:
            Time4MishnaView()
        case .speakerDetail(let rabbi):
            SpeakerDetailView(rabbi: rabbi)
        case .viewShiur(let id):
            ShiurPlayerView(shiurId: id)
        case .upload:
            UploadView()
        }
    }

    @ViewBuilder
    private func destination(for page: AppPage) -> some View {
        switch page {
        case .viewShiur(let id):
            ShiurPlayerView(shiurId: id)
        case .speakerDetail(let rabbi):
            SpeakerDetailView(rabbi: rabbi)
        default:
            EmptyView()
        }
    }
}
