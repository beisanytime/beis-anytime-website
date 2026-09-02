import SwiftUI
import Combine

// MARK: - Toast Manager
@MainActor
final class ToastManager: ObservableObject {
    @Published var message: String?
    @Published var type: ToastType = .success
    @Published var isVisible = false

    func show(_ message: String, type: ToastType = .success) {
        self.message = message
        self.type = type
        withAnimation { isVisible = true }
        Task {
            try? await Task.sleep(for: .seconds(3))
            withAnimation { isVisible = false }
        }
    }
}

enum ToastType {
    case success, error

    var color: Color {
        switch self {
        case .success: return .appSuccess
        case .error: return .appDanger
        }
    }

    var icon: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.circle.fill"
        }
    }
}

// MARK: - Toast View
struct ToastView: View {
    @EnvironmentObject var toast: ToastManager

    var body: some View {
        if toast.isVisible, let message = toast.message {
            HStack(spacing: 10) {
                Image(systemName: toast.type.icon)
                    .foregroundStyle(toast.type.color)
                Text(message)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.black.opacity(0.9))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.3), radius: 10, y: 4)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .padding(.bottom, 100)
        }
    }
}
