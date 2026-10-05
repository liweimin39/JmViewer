package com.liweimin.jmviewer;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ★ 必须在 super.onCreate 之前注册
        registerPlugin(StoragePermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}