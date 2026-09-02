import SwiftUI

@main
struct beisanytimeApp: App {
    @StateObject private var viewModel = AppViewModel()
    @StateObject private var toastManager = ToastManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
                .environmentObject(toastManager)
                .preferredColorScheme(viewModel.isDarkMode ? .dark : .light)
        }
    }
}
