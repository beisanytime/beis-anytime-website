import SwiftUI

// MARK: - Color Definitions from Web CSS
extension Color {
    // Speaker accent colors
    static let hartmanBlue = Color(hue: 215/360, saturation: 0.95, brightness: 0.50)
    static let rosenfeldGreen = Color(hue: 160/360, saturation: 0.85, brightness: 0.40)
    static let golkerOrange = Color(hue: 35/360, saturation: 0.95, brightness: 0.55)
    static let guestsPurple = Color(hue: 265/360, saturation: 0.90, brightness: 0.65)

    // Functional
    static let appAccent = Color(hue: 225/360, saturation: 0.90, brightness: 0.55)
    static let appSuccess = Color(hex: "10b981")
    static let appDanger = Color(hex: "ef4444")
    static let appWarning = Color(hex: "f59e0b")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255, opacity: Double(a)/255)
    }
}

// MARK: - Theme Environment
enum AppTheme: String {
    case light, dark

    var colorScheme: ColorScheme {
        switch self {
        case .light: return .light
        case .dark: return .dark
        }
    }
}

// Light theme colors
struct LightColors {
    static let background = Color(hex: "f8fafc")
    static let surface = Color.white
    static let surfaceHover = Color(hex: "f1f5f9")
    static let textMain = Color(hex: "0f172a")
    static let textMuted = Color(hex: "64748b")
    static let textFaint = Color(hex: "94a3b8")
    static let borderLight = Color(hex: "e2e8f0")
    static let borderHover = Color(hex: "cbd5e1")
}

// Dark theme colors
struct DarkColors {
    static let background = Color(hex: "020617")
    static let surface = Color(hex: "0f172a")
    static let surfaceHover = Color(hex: "1e293b")
    static let textMain = Color(hex: "f8fafc")
    static let textMuted = Color(hex: "94a3b8")
    static let textFaint = Color(hex: "475569")
    static let borderLight = Color(hex: "1e293b")
    static let borderHover = Color(hex: "334155")
}

// MARK: - Adaptive Color
struct AppColors {
    @Environment(\.colorScheme) private var colorScheme

    var background: Color {
        colorScheme == .dark ? DarkColors.background : LightColors.background
    }
    var surface: Color {
        colorScheme == .dark ? DarkColors.surface : LightColors.surface
    }
    var surfaceHover: Color {
        colorScheme == .dark ? DarkColors.surfaceHover : LightColors.surfaceHover
    }
    var textMain: Color {
        colorScheme == .dark ? DarkColors.textMain : LightColors.textMain
    }
    var textMuted: Color {
        colorScheme == .dark ? DarkColors.textMuted : LightColors.textMuted
    }
    var borderLight: Color {
        colorScheme == .dark ? DarkColors.borderLight : LightColors.borderLight
    }
    var borderHover: Color {
        colorScheme == .dark ? DarkColors.borderHover : LightColors.borderHover
    }
}
