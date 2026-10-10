package com.liweimin.jmviewer;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 应用图标切换插件（仅 Android）
 * 通过 PackageManager.setComponentEnabledSetting 启用/禁用 AndroidManifest 中
 * 声明的 activity-alias（IconAliasBlue/Green/Purple/Gray/Dark）实现桌面图标更换。
 * pink 为默认图标，即 MainActivity 自身。
 */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    /** 主题名 -> alias 类名（pink 无 alias，使用 MainActivity 默认图标） */
    private static final String[] ALIAS_NAMES = {
        "IconAliasBlue", "IconAliasGreen", "IconAliasPurple", "IconAliasGray", "IconAliasDark"
    };
    private static final String[] ALIAS_THEMES = {
        "blue", "green", "purple", "gray", "dark"
    };

    @PluginMethod
    public void setIcon(PluginCall call) {
        String theme = call.getString("theme", "pink");
        String pkg = getContext().getPackageName();
        PackageManager pm = getContext().getPackageManager();
        ComponentName main = new ComponentName(pkg, MainActivity.class.getName());

        // 1. 启用目标组件（pink -> MainActivity；其它 -> 对应 alias）
        ComponentName target = main;
        if (!"pink".equals(theme)) {
            int idx = -1;
            for (int i = 0; i < ALIAS_THEMES.length; i++) {
                if (ALIAS_THEMES[i].equals(theme)) { idx = i; break; }
            }
            if (idx < 0) {
                call.reject("未知图标主题：" + theme);
                return;
            }
            target = new ComponentName(pkg, pkg + "." + ALIAS_NAMES[idx]);
        }
        pm.setComponentEnabledSetting(target,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP);

        // 2. 禁用其它 alias
        for (int i = 0; i < ALIAS_NAMES.length; i++) {
            ComponentName alias = new ComponentName(pkg, pkg + "." + ALIAS_NAMES[i]);
            if (alias.equals(target)) continue;
            pm.setComponentEnabledSetting(alias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
        }

        JSObject ret = new JSObject();
        ret.put("theme", theme);
        call.resolve(ret);
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        String pkg = getContext().getPackageName();
        PackageManager pm = getContext().getPackageManager();
        String theme = "pink";
        for (int i = 0; i < ALIAS_NAMES.length; i++) {
            ComponentName alias = new ComponentName(pkg, pkg + "." + ALIAS_NAMES[i]);
            int state = pm.getComponentEnabledSetting(alias);
            if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                theme = ALIAS_THEMES[i];
                break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("theme", theme);
        call.resolve(ret);
    }
}
