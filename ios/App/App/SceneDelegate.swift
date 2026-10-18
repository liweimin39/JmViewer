import UIKit
import Capacitor
import WebKit

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
        CAPPluginMethod(name: "clearWebCache", returnType: CAPPluginReturnPromise),
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

    /// 清理 WebView 的网页缓存（图片等静态资源）
    /// 只清缓存类数据，不动 cookies / localStorage / IndexedDB，避免用户被登出或丢失本地数据
    @objc func clearWebCache(_ call: CAPPluginCall) {
        let types: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
            WKWebsiteDataTypeFetchCache,
        ]

        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {
            // WKWebView 的部分请求仍走 URLCache 共享缓存，一并清掉
            URLCache.shared.removeAllCachedResponses()
            call.resolve()
        }
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