package com.win10.simulator;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private int lastImeBottom = 0;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(EmbeddedWebViewPlugin.class);
    super.onCreate(savedInstanceState);
    applyImmersiveAndKeepAwake();
    setupKeyboardInsetsListener();

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

  private void setupKeyboardInsetsListener() {
    View contentView = findViewById(android.R.id.content);
    if (contentView == null) return;
    ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      int imeBottom = Math.max(0, ime.bottom);
      if (v.getPaddingBottom() != imeBottom) {
        v.setPadding(v.getPaddingLeft(), v.getPaddingTop(), v.getPaddingRight(), imeBottom);
      }
      if (imeBottom != lastImeBottom) {
        lastImeBottom = imeBottom;
        EmbeddedWebViewPlugin plugin = EmbeddedWebViewPlugin.getInstance();
        if (plugin != null) {
          plugin.onKeyboardHeightChanged(imeBottom);
        }
      }
      return insets;
    });
  }

  @Override
  public void onPause() {
    super.onPause();
    EmbeddedWebViewPlugin plugin = EmbeddedWebViewPlugin.getInstance();
    if (plugin != null) {
      plugin.onHostFocusLostOrPaused();
    }
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyImmersiveAndKeepAwake();
    } else {
      EmbeddedWebViewPlugin plugin = EmbeddedWebViewPlugin.getInstance();
      if (plugin != null) {
        plugin.onHostFocusLostOrPaused();
      }
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
