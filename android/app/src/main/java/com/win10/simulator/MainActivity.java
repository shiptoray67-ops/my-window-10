package com.win10.simulator;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(EmbeddedWebViewPlugin.class);
    super.onCreate(savedInstanceState);
    applyImmersiveAndKeepAwake();

    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        EmbeddedWebViewPlugin plugin = EmbeddedWebViewPlugin.getInstance();
        if (plugin != null && plugin.handleBackPressed()) {
          return;
        }
        setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        setEnabled(true);
      }
    });
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyImmersiveAndKeepAwake();
    }
  }

  public void applyImmersiveAndKeepAwake() {
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams lp = getWindow().getAttributes();
      lp.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      getWindow().setAttributes(lp);
    }

    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
      getWindow(),
      getWindow().getDecorView()
    );
    if (controller != null) {
      controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      );
      controller.hide(WindowInsetsCompat.Type.systemBars());
    }
  }
}
