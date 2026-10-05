package com.liweimin.jmviewer;

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

        // ② 降级：原生文件管理器
        if (tryOpenWithSystemFileManager(folder, filePath)) {
            call.resolve();
            return;
        }

        // ③ 兜底：Toast 显示路径
        Toast.makeText(getContext(), "文件路径：\n" + filePath, Toast.LENGTH_LONG).show();
        call.resolve();
    }

    // ==================== 辅助：MT 管理器 ====================

    private boolean tryOpenWithMT(String filePath) {
        // 先检查是否安装
        try {
            getContext().getPackageManager().getPackageInfo("bin.mt.plus", 0);
        } catch (Exception e) {
            return false;
        }

        // 尝试多个可能的入口 Activity（不同版本 MT 的类名不同）
        String[] activities = {
            "bin.mt.plus.Main",
            "bin.mt.plus.MainActivity",
            "bin.mt.plus.HomeActivity"
        };

        for (String activity : activities) {
            try {
                Intent intent = new Intent();
                intent.setClassName("bin.mt.plus", activity);
                intent.putExtra("path", filePath);
                intent.putExtra("folderColorIcon", "ic_folder");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                return true;
            } catch (Exception ignored) {
                // 尝试下一个
            }
        }

        // 再试一次用 Action
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

    // ==================== 辅助：原生文件管理器 ====================

    private boolean tryOpenWithSystemFileManager(File folder, String filePath) {
        Uri folderUri = null;

        // 生成 FileProvider URI
        try {
            folderUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                folder
            );
        } catch (Exception e) {
            // 可能是 file_paths.xml 没配好
        }

        // 方法 1：ACTION_VIEW + 目录 MIME
        if (folderUri != null) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(folderUri, "vnd.android.document/directory");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, folderUri);
                }
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                    getActivity().startActivity(intent);
                    return true;
                }
            } catch (Exception ignored) {}
        }

        // 方法 2：ACTION_OPEN_DOCUMENT_TREE
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (folderUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, folderUri);
            }
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getActivity().startActivity(intent);
                return true;
            }
        } catch (Exception ignored) {}

        // 方法 3：ACTION_GET_CONTENT
        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            return true;
        } catch (Exception ignored) {}

        return false;
    }
}