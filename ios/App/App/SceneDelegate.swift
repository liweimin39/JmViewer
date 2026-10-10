import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)

        let bridgeVC = CAPBridgeViewController()
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        bridgeVC.loadViewIfNeeded()

        if let bridge = bridgeVC.bridge {
            bridge.registerPluginInstance(StoragePermissionPlugin())
            bridge.registerPluginInstance(AppIconPlugin())
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// =====================================================
// MARK: - StoragePermissionPlugin
// =====================================================

@objc(StoragePermissionPlugin)
public class StoragePermissionPlugin: CAPPlugin, CAPBridgedPlugin {

    // ★ Capacitor 8 必须声明这三个属性
    public let identifier = "StoragePermissionPlugin"
    public let jsName = "StoragePermission"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkAllFilesAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAllFilesAccess", returnType: CAPPluginReturnPromise),
    ]

    @objc func openFolder(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("缺少 path 参数")
            return
        }

        // 尝试用 shareddocuments:// 打开系统「文件」App
        var sharedPath = path
        if sharedPath.hasPrefix("file://") {
            sharedPath = sharedPath.replacingOccurrences(of: "file://", with: "shareddocuments://")
        }

        if let url = URL(string: sharedPath) {
            DispatchQueue.main.async {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                    call.resolve()
                } else {
                    self.showToast(message: "文件路径：\n\(path)")
                    call.resolve()
                }
            }
            return
        }

        showToast(message: "文件路径：\n\(path)")
        call.resolve()
    }

    @objc func checkAllFilesAccess(_ call: CAPPluginCall) {
        call.resolve(["granted": true])
    }

    @objc func openAllFilesAccess(_ call: CAPPluginCall) {
        call.resolve()
    }

    // MARK: - 辅助

    private func showToast(message: String) {
        DispatchQueue.main.async {
            guard let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else {
                return
            }

            let alert = UIAlertController(
                title: nil,
                message: message,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "确定", style: .default))

            var topController = window.rootViewController
            while let presented = topController?.presentedViewController {
                topController = presented
            }
            topController?.present(alert, animated: true)
        }
    }
}

// =====================================================
// MARK: - AppIconPlugin（主题图标切换，iOS 10.3+）
// =====================================================

@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {

    // ★ Capacitor 8 必须声明这三个属性
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIcon", returnType: CAPPluginReturnPromise),
    ]

    @objc func setIcon(_ call: CAPPluginCall) {
        let theme = call.getString("theme") ?? "pink"
        guard UIApplication.shared.supportsAlternateIcons else {
            call.reject("当前系统不支持切换图标")
            return
        }
        // pink 为主图标，alternateIconName 传 nil；其余主题名即 CFBundleAlternateIcons 的 key
        let name: String? = theme == "pink" ? nil : theme
        DispatchQueue.main.async {
            UIApplication.shared.setAlternateIconName(name) { error in
                if let error = error {
                    call.reject("切换图标失败：" + error.localizedDescription)
                } else {
                    call.resolve(["theme": theme])
                }
            }
        }
    }

    @objc func getIcon(_ call: CAPPluginCall) {
        let theme = UIApplication.shared.alternateIconName ?? "pink"
        call.resolve(["theme": theme])
    }
}
