package com.liweimin.jmviewer;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "StoragePermission")
public class StoragePermissionPlugin extends Plugin {

    /** 打开"所有文件访问"设置页（Android 11+） */
    @PluginMethod
    public void openAllFilesAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            call.reject("当前系统版本无需此权限");
            return;
        }

        // 尝试 1：直接跳到本 App 的"所有文件访问"页面
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception e) {
            // fallthrough
        }

        // 尝试 2：打开"所有文件访问"列表页
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception e) {
            // fallthrough
        }

        // 尝试 3：打开本 App 的应用详情页
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开设置页面：" + e.getMessage());
        }
    }

    /** 检查是否已授权"所有文件访问" */
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

    /** 打开文件夹 */
    @PluginMethod
    public void openFolder(PluginCall call) {
        String path = call.getString("path", "");
        if (path.isEmpty()) {
            call.reject("缺少 path 参数");
            return;
        }

        // 从 file:// URI 或绝对路径提取
        String filePath = path;
        if (filePath.startsWith("file://")) {
            filePath = filePath.substring(7);
        }
        filePath = Uri.decode(filePath);

        File folder = new File(filePath);

        // 检查目录是否存在
        if (!folder.exists() || !folder.isDirectory()) {
            File parent = folder.getParentFile();
            if (parent != null && parent.exists() && parent.isDirectory()) {
                folder = parent;
            } else {
                call.reject("文件夹不存在：" + filePath);
                return;
            }
        }

        // 尝试 1：用 DocumentsUI 打开（大部分 Android 10+ 有效）
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.fromFile(folder), "resource/folder");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception e) {
            // fallthrough
        }

        // 尝试 2：用 FileProvider + ACTION_VIEW 打开
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri uri = androidx.core.content.FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                folder
            );
            intent.setDataAndType(uri, "resource/folder");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception e) {
            // fallthrough
        }

        // 尝试 3：启动文件管理器（打开根目录）
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.setType("file/*");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception e) {
            // fallthrough
        }

        // 兜底：Toast 显示路径
        try {
            Toast.makeText(
                getContext(),
                "文件路径：\n" + filePath,
                Toast.LENGTH_LONG
            ).show();
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开文件夹：" + e.getMessage());
        }
    }
}