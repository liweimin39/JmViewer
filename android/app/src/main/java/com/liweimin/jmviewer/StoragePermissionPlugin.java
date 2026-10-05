package com.liweimin.jmviewer;

import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "StoragePermission")
public class StoragePermissionPlugin extends Plugin {

    // ==================== 权限 ====================

    @PluginMethod
    public void openAllFilesAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            call.reject("当前系统版本无需此权限");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception ignored) {}

        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception ignored) {}

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开设置页面：" + e.getMessage());
        }
    }

    @PluginMethod
    public void checkAllFilesAccess(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            result.put("granted", Environment.isExternalStorageManager());
        } else {
            result.put("granted", true);
        }
        call.resolve(result);
    }

    // ==================== 打开文件夹 ====================

    @PluginMethod
    public void openFolder(PluginCall call) {
        String path = call.getString("path", "");
        if (path.isEmpty()) {
            call.reject("缺少 path 参数");
            return;
        }

        // 规范化路径
        String filePath = path;
        if (filePath.startsWith("file://")) {
            filePath = filePath.substring(7);
        }
        filePath = Uri.decode(filePath);

        File folder = new File(filePath);
        if (!folder.exists() || !folder.isDirectory()) {
            File parent = folder.getParentFile();
            if (parent != null && parent.exists() && parent.isDirectory()) {
                folder = parent;
                filePath = folder.getAbsolutePath();
            } else {
                call.reject("文件夹不存在：" + filePath);
                return;
            }
        }

        // ① 优先 MT 管理器
        if (tryOpenWithMT(filePath)) {
            call.resolve();
            return;
        }

        // ② 降级：系统文件管理器（用 DocumentsContract URI）
        if (tryOpenWithSystemFileManager(filePath)) {
            call.resolve();
            return;
        }

        // ③ 兜底：Toast 显示路径
        Toast.makeText(getContext(), "文件路径：\n" + filePath, Toast.LENGTH_LONG).show();
        call.resolve();
    }

    // ==================== MT 管理器 ====================

    private boolean tryOpenWithMT(String filePath) {
        // 检查是否安装
        try {
            getContext().getPackageManager().getPackageInfo("bin.mt.plus", 0);
        } catch (Exception e) {
            return false;   // 未安装
        }

        // 方案 1：直接 setClassName + path extra
        String[] activityNames = {
            "bin.mt.plus.Main",
            "bin.mt.plus.MainActivity",
            "bin.mt.plus.HomeActivity",
            "bin.mt.plus.activity.MainActivity"
        };

        for (String activityName : activityNames) {
            try {
                Intent intent = new Intent();
                intent.setComponent(new ComponentName("bin.mt.plus", activityName));
                intent.putExtra("path", filePath);
                intent.putExtra("operation", "goto");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                return true;
            } catch (Exception ignored) {
                // 尝试下一个
            }
        }

        // 方案 2：ACTION_VIEW + file:// + setPackage
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.fromFile(new File(filePath)), "resource/folder");
            intent.setPackage("bin.mt.plus");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            return true;
        } catch (Exception ignored) {}

        // 方案 3：自定义 Action
        try {
            Intent intent = new Intent("bin.mt.plus.ACTION_SHORTCUT");
            intent.setPackage("bin.mt.plus");
            intent.putExtra("path", filePath);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            return true;
        } catch (Exception ignored) {}

        return false;
    }

    // ==================== 系统文件管理器 ====================

    private boolean tryOpenWithSystemFileManager(String filePath) {
        // 关键：把绝对路径转成 DocumentsContract 的 URI
        // /storage/emulated/0/JmViewer/Comics/xxx
        // → primary:JmViewer/Comics/xxx
        String relativePath = toRelativeStoragePath(filePath);
        if (relativePath != null) {
            try {
                Uri documentUri = DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents",
                    "primary:" + relativePath
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(documentUri, DocumentsContract.Document.MIME_TYPE_DIR);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                    getActivity().startActivity(intent);
                    return true;
                }
            } catch (Exception ignored) {}
        }

        // 降级：ACTION_OPEN_DOCUMENT_TREE（让用户手动选）
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (relativePath != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Uri documentUri = DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents",
                    "primary:" + relativePath
                );
                intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, documentUri);
            }
            getActivity().startActivity(intent);
            return true;
        } catch (Exception ignored) {}

        return false;
    }

    /**
     * 把绝对路径转成 "JmViewer/Comics/xxx" 形式
     * 只处理 primary 存储（/storage/emulated/0/）
     */
    private String toRelativeStoragePath(String absolutePath) {
        String primary = Environment.getExternalStorageDirectory().getAbsolutePath();
        if (absolutePath.startsWith(primary)) {
            String rel = absolutePath.substring(primary.length());
            // 去掉开头的 /
            if (rel.startsWith("/")) rel = rel.substring(1);
            return rel;
        }
        return null;
    }
}