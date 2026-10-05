import Foundation
import Capacitor
import UIKit

@objc(StoragePermissionPlugin)
public class StoragePermissionPlugin: CAPPlugin {
    
    @objc func openFolder(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("缺少 path 参数")
            return
        }
        
        // 尝试 1：用 shareddocuments:// 打开系统「文件」App
        // 这个 Scheme 从 iOS 11+ 开始可用，能把 Documents 映射到「文件」App 中
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
                    // 降级：Toast 提示路径
                    self.showToast(message: "文件路径：\n\(path)")
                    call.resolve()
                }
            }
            return
        }
        
        // 兜底：Toast 提示路径
        showToast(message: "文件路径：\n\(path)")
        call.resolve()
    }
    
    @objc func checkAllFilesAccess(_ call: CAPPluginCall) {
        // iOS 无此权限概念，始终返回已授权
        call.resolve(["granted": true])
    }
    
    @objc func openAllFilesAccess(_ call: CAPPluginCall) {
        // iOS 无需跳转，直接成功
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