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

        // 强制加载视图，确保 bridge 已初始化
        bridgeVC.loadViewIfNeeded()

        // 注册自定义插件
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
// 直接定义在 SceneDelegate.swift 里，避免单独文件的 target 问题

@objc(StoragePermissionPlugin)
public class StoragePermissionPlugin: CAPPlugin {

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
        // iOS 无此权限概念
        call.resolve(["granted": true])
    }

    @objc func openAllFilesAccess(_ call: CAPPluginCall) {
        // iOS 无需跳转
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