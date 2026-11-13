package com.win10.simulator;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "EmbeddedWebView")
public class EmbeddedWebViewPlugin extends Plugin {

  private static final String MOBILE_USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

  private static final String DESKTOP_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  private static WeakReference<EmbeddedWebViewPlugin> instanceRef = new WeakReference<>(null);

  public static EmbeddedWebViewPlugin getInstance() {
    return instanceRef.get();
  }

  private static class WebViewEntry {
    final String id;
    final WebView webView;
    final boolean incognito;
    boolean desktopMode;
    boolean visible = true;
    int zoomPercent = 100;
    String currentUrl = "about:blank";
    String currentTitle = "";
    int progress = 0;
    String lastFindQuery = "";
    double cssX = 0;
    double cssY = 0;
    double cssWidth = 0;
    double cssHeight = 0;
    double cssDpr = 0;
    long dragDownTime = 0;
    Runnable pendingLongPressUp = null;

    WebViewEntry(String id, WebView webView, boolean incognito, boolean desktopMode) {
      this.id = id;
      this.webView = webView;
      this.incognito = incognito;
      this.desktopMode = desktopMode;
    }
  }

  private final Map<String, WebViewEntry> webViews = new HashMap<>();
  private final List<String> zOrderIds = new ArrayList<>();
  private FrameLayout overlayContainer;
  private View touchInterceptorView;
  private boolean mouseModeTouchIntercept = false;
  private boolean forwardingTouchStream = false;

  // Always-on-top native cursor
  private ImageView cursorView;
  private boolean cursorVisible = false;
  private String cursorType = "arrow";
  private double cursorCssX = 0;
  private double cursorCssY = 0;
  private double cursorDpr = 0;
  private float cursorHotspotX = 2f;
  private float cursorHotspotY = 2f;
  private final Map<String, Bitmap> cursorBitmapCache = new HashMap<>();

  // Fullscreen video container
  private FrameLayout fullscreenContainer;
  private View customView;
  private WebChromeClient.CustomViewCallback customViewCallback;

  // Pickers & Permissions
  private ActivityResultLauncher<Intent> fileChooserLauncher;
  private ValueCallback<Uri[]> pendingFilePathCallback;
  private ActivityResultLauncher<String[]> geoPermissionLauncher;
  private GeolocationPermissions.Callback pendingGeoCallback;
  private String pendingGeoOrigin;

  // In-app APK updater state
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private long activeUpdateDownloadId = -1L;
  private File pendingUpdateApkFile = null;
  private BroadcastReceiver updateDownloadReceiver = null;
  private Runnable updateProgressPoller = null;

  @Override
  public void load() {
    super.load();
    instanceRef = new WeakReference<>(this);

    fileChooserLauncher = getBridge().registerForActivityResult(
      new ActivityResultContracts.StartActivityForResult(),
      (ActivityResult result) -> {
        if (pendingFilePathCallback == null) return;
        Uri[] uris = null;
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
          if (data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            uris = new Uri[count];
            for (int i = 0; i < count; i++) {
              uris[i] = data.getClipData().getItemAt(i).getUri();
            }
          } else {
            uris = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), data);
          }
        }
        pendingFilePathCallback.onReceiveValue(uris);
        pendingFilePathCallback = null;
      }
    );

    geoPermissionLauncher = getBridge().registerForActivityResult(
      new ActivityResultContracts.RequestMultiplePermissions(),
      (Map<String, Boolean> grants) -> {
        if (pendingGeoCallback != null && pendingGeoOrigin != null) {
          boolean granted = false;
          for (Boolean g : grants.values()) {
            if (Boolean.TRUE.equals(g)) {
              granted = true;
              break;
            }
          }
          pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
        }
        pendingGeoCallback = null;
        pendingGeoOrigin = null;
      }
    );
  }

  @Override
  protected void handleOnPause() {
    super.handleOnPause();
    try {
      CookieManager.getInstance().flush();
    } catch (Exception ignored) {}
  }

  @Override
  protected void handleOnDestroy() {
    super.handleOnDestroy();
    try {
      CookieManager.getInstance().flush();
    } catch (Exception ignored) {}
    unregisterUpdateReceiver();
    if (getBridge() != null) {
      getBridge().executeOnMainThread(() -> {
        for (WebViewEntry entry : webViews.values()) {
          cleanupWebView(entry);
        }
        webViews.clear();
        zOrderIds.clear();
      });
    }
  }

  public boolean handleBackPressed() {
    if (customView != null) {
      hideCustomView();
      return true;
    }
    for (int i = zOrderIds.size() - 1; i >= 0; i--) {
      WebViewEntry entry = webViews.get(zOrderIds.get(i));
      if (entry != null && entry.visible && entry.webView.getVisibility() == View.VISIBLE && entry.webView.canGoBack()) {
        entry.webView.goBack();
        return true;
      }
    }
    return false;
  }

  // =========================================================================
  // OVERLAY CONTAINER & TOUCH INTERCEPTOR
  // =========================================================================

  @SuppressLint("ClickableViewAccessibility")
  private void ensureOverlayContainer() {
    WebView capWebView = getBridge().getWebView();
    if (capWebView == null || !(capWebView.getParent() instanceof ViewGroup)) return;

    if (overlayContainer == null || overlayContainer.getParent() == null) {
      ViewGroup parent = (ViewGroup) capWebView.getParent();
      overlayContainer = new FrameLayout(getContext());
      overlayContainer.setLayoutParams(
        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      );
      overlayContainer.setClipChildren(true);
      overlayContainer.setClipToPadding(true);
      int idx = parent.indexOfChild(capWebView);
      parent.addView(overlayContainer, idx + 1);
    }

    if (touchInterceptorView == null || touchInterceptorView.getParent() != overlayContainer) {
      touchInterceptorView = new View(getContext());
      touchInterceptorView.setLayoutParams(
        new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      );
      touchInterceptorView.setBackgroundColor(Color.TRANSPARENT);
      touchInterceptorView.setClickable(false);
      touchInterceptorView.setFocusable(false);
      touchInterceptorView.setVisibility(mouseModeTouchIntercept ? View.VISIBLE : View.GONE);

      touchInterceptorView.setOnTouchListener((v, ev) -> {
        if (!mouseModeTouchIntercept) {
          forwardingTouchStream = false;
          return false;
        }
        int action = ev.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) {
          forwardingTouchStream = isPointInsideAnyVisibleWebView(ev.getX(), ev.getY());
          if (!forwardingTouchStream) {
            return false;
          }
        }
        if (!forwardingTouchStream) {
          return false;
        }

        forwardTouchEventToCapacitor(ev);

        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
          forwardingTouchStream = false;
        }
        return true;
      });

      overlayContainer.addView(touchInterceptorView);
    }
  }

  private boolean isPointInsideAnyVisibleWebView(float rawX, float rawY) {
    for (int i = zOrderIds.size() - 1; i >= 0; i--) {
      WebViewEntry entry = webViews.get(zOrderIds.get(i));
      if (entry != null && entry.visible && entry.webView.getVisibility() == View.VISIBLE) {
        float left = entry.webView.getLeft();
        float top = entry.webView.getTop();
        float right = left + entry.webView.getWidth();
        float bottom = top + entry.webView.getHeight();
        if (rawX >= left && rawX <= right && rawY >= top && rawY <= bottom) {
          return true;
        }
      }
    }
    return false;
  }

  private void forwardTouchEventToCapacitor(MotionEvent ev) {
    WebView capWebView = getBridge().getWebView();
    if (capWebView == null || touchInterceptorView == null) return;
    int[] intLoc = new int[2];
    int[] capLoc = new int[2];
    touchInterceptorView.getLocationInWindow(intLoc);
    capWebView.getLocationInWindow(capLoc);
    float dx = intLoc[0] - capLoc[0];
    float dy = intLoc[1] - capLoc[1];
    MotionEvent copy = MotionEvent.obtain(ev);
    copy.offsetLocation(dx, dy);
    capWebView.dispatchTouchEvent(copy);
    copy.recycle();
  }

  private void applyLayoutParams(WebViewEntry entry) {
    if (overlayContainer == null) return;
    WebView capWebView = getBridge().getWebView();
    float dpr = entry.cssDpr > 0 ? (float) entry.cssDpr : getContext().getResources().getDisplayMetrics().density;
    if (dpr <= 0f) dpr = 1f;

    int offsetX = 0;
    int offsetY = 0;
    if (capWebView != null) {
      int[] capLoc = new int[2];
      int[] overlayLoc = new int[2];
      capWebView.getLocationInWindow(capLoc);
      overlayContainer.getLocationInWindow(overlayLoc);
      offsetX = capLoc[0] - overlayLoc[0];
      offsetY = capLoc[1] - overlayLoc[1];
    }

    int pxW = Math.round((float) entry.cssWidth * dpr);
    int pxH = Math.round((float) entry.cssHeight * dpr);
    int pxX = Math.round((float) entry.cssX * dpr) + offsetX;
    int pxY = Math.round((float) entry.cssY * dpr) + offsetY;

    if (!entry.visible || pxW <= 1 || pxH <= 1) {
      entry.webView.setVisibility(View.GONE);
      return;
    }

    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(pxW, pxH);
    params.leftMargin = pxX;
    params.topMargin = pxY;
    entry.webView.setLayoutParams(params);
    entry.webView.setVisibility(View.VISIBLE);
    if (touchInterceptorView != null && mouseModeTouchIntercept) {
      touchInterceptorView.bringToFront();
    }
    bringCursorToFront();
  }

  // =========================================================================
  // ALWAYS-ON-TOP NATIVE CURSOR RENDERING
  // =========================================================================

  private void ensureCursorView() {
    Activity activity = getActivity();
    if (activity == null) return;
    View decor = activity.getWindow().getDecorView();
    if (!(decor instanceof ViewGroup)) return;
    ViewGroup decorGroup = (ViewGroup) decor;

    if (cursorView == null) {
      cursorView = new ImageView(activity);
      cursorView.setClickable(false);
      cursorView.setFocusable(false);
      cursorView.setFocusableInTouchMode(false);
      cursorView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
      cursorView.setScaleType(ImageView.ScaleType.CENTER);
      FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.TOP | Gravity.START
      );
      cursorView.setLayoutParams(lp);
      cursorView.setVisibility(View.GONE);
      applyCursorBitmap(cursorType);
    }

    if (cursorView.getParent() != decorGroup) {
      if (cursorView.getParent() instanceof ViewGroup) {
        ((ViewGroup) cursorView.getParent()).removeView(cursorView);
      }
      decorGroup.addView(cursorView);
    }
    cursorView.bringToFront();
  }

  private void bringCursorToFront() {
    if (cursorView != null && cursorVisible) {
      ensureCursorView();
      cursorView.bringToFront();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        cursorView.setElevation(1000f);
        cursorView.setTranslationZ(1000f);
      }
    }
  }

  private void updateCursorTranslation() {
    if (cursorView == null || !cursorVisible) return;
    Activity activity = getActivity();
    WebView capWebView = getBridge().getWebView();
    if (activity == null || capWebView == null) return;
    View decor = activity.getWindow().getDecorView();

    float dpr = cursorDpr > 0 ? (float) cursorDpr : getContext().getResources().getDisplayMetrics().density;
    if (dpr <= 0f) dpr = 1f;

    int[] capLoc = new int[2];
    int[] decorLoc = new int[2];
    capWebView.getLocationInWindow(capLoc);
    decor.getLocationInWindow(decorLoc);

    float offsetX = capLoc[0] - decorLoc[0];
    float offsetY = capLoc[1] - decorLoc[1];
    float px = (float) cursorCssX * dpr + offsetX - cursorHotspotX;
    float py = (float) cursorCssY * dpr + offsetY - cursorHotspotY;

    cursorView.setTranslationX(px);
    cursorView.setTranslationY(py);
  }

  private void applyCursorBitmap(String type) {
    String normalized = type != null ? type : "arrow";
    cursorType = normalized;
    float density = getContext().getResources().getDisplayMetrics().density;
    if (density <= 0f) density = 1f;

    switch (normalized) {
      case "hand":
        cursorHotspotX = 9f * density;
        cursorHotspotY = 2f * density;
        break;
      case "text":
        cursorHotspotX = 11f * density;
        cursorHotspotY = 12f * density;
        break;
      case "resize-ew":
      case "resize-ns":
      case "resize-nwse":
      case "resize-nesw":
        cursorHotspotX = 12f * density;
        cursorHotspotY = 12f * density;
        break;
      case "arrow":
      default:
        cursorHotspotX = 2f * density;
        cursorHotspotY = 2f * density;
        break;
    }

    Bitmap bmp = cursorBitmapCache.get(normalized);
    if (bmp == null) {
      bmp = createCursorBitmap(normalized, density);
      cursorBitmapCache.put(normalized, bmp);
    }
    if (cursorView != null) {
      cursorView.setImageBitmap(bmp);
      updateCursorTranslation();
    }
  }

  private Bitmap createCursorBitmap(String type, float d) {
    int size = Math.round(28f * d);
    Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(bmp);

    Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    fill.setColor(Color.WHITE);
    fill.setStyle(Paint.Style.FILL);

    Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    stroke.setColor(Color.rgb(18, 18, 18));
    stroke.setStyle(Paint.Style.STROKE);
    stroke.setStrokeWidth(Math.max(1.5f, 1.5f * d));
    stroke.setStrokeJoin(Paint.Join.ROUND);
    stroke.setStrokeCap(Paint.Cap.ROUND);

    Path p = new Path();
    if ("hand".equals(type)) {
      // Pointing hand cursor
      p.moveTo(9f * d, 2f * d);
      p.lineTo(11.5f * d, 2f * d);
      p.lineTo(11.5f * d, 10f * d);
      p.lineTo(18.5f * d, 11.2f * d);
      p.lineTo(19.5f * d, 18f * d);
      p.lineTo(17f * d, 23f * d);
      p.lineTo(8.5f * d, 23f * d);
      p.lineTo(5f * d, 16.5f * d);
      p.lineTo(6.8f * d, 14.5f * d);
      p.lineTo(9f * d, 16.5f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
    } else if ("text".equals(type)) {
      // I-Beam text cursor
      Paint outline = new Paint(Paint.ANTI_ALIAS_FLAG);
      outline.setColor(Color.WHITE);
      outline.setStyle(Paint.Style.STROKE);
      outline.setStrokeWidth(Math.max(3.2f, 3.2f * d));
      outline.setStrokeCap(Paint.Cap.ROUND);

      Paint inner = new Paint(Paint.ANTI_ALIAS_FLAG);
      inner.setColor(Color.rgb(20, 20, 20));
      inner.setStyle(Paint.Style.STROKE);
      inner.setStrokeWidth(Math.max(1.6f, 1.6f * d));
      inner.setStrokeCap(Paint.Cap.ROUND);

      p.moveTo(7.5f * d, 4f * d);
      p.lineTo(14.5f * d, 4f * d);
      p.moveTo(11f * d, 4f * d);
      p.lineTo(11f * d, 20f * d);
      p.moveTo(7.5f * d, 20f * d);
      p.lineTo(14.5f * d, 20f * d);

      c.drawPath(p, outline);
      c.drawPath(p, inner);
    } else if ("resize-ew".equals(type)) {
      p.moveTo(2f * d, 12f * d);
      p.lineTo(7f * d, 7.5f * d);
      p.lineTo(7f * d, 10.5f * d);
      p.lineTo(17f * d, 10.5f * d);
      p.lineTo(17f * d, 7.5f * d);
      p.lineTo(22f * d, 12f * d);
      p.lineTo(17f * d, 16.5f * d);
      p.lineTo(17f * d, 13.5f * d);
      p.lineTo(7f * d, 13.5f * d);
      p.lineTo(7f * d, 16.5f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
    } else if ("resize-ns".equals(type)) {
      p.moveTo(12f * d, 2f * d);
      p.lineTo(16.5f * d, 7f * d);
      p.lineTo(13.5f * d, 7f * d);
      p.lineTo(13.5f * d, 17f * d);
      p.lineTo(16.5f * d, 17f * d);
      p.lineTo(12f * d, 22f * d);
      p.lineTo(7.5f * d, 17f * d);
      p.lineTo(10.5f * d, 17f * d);
      p.lineTo(10.5f * d, 7f * d);
      p.lineTo(7.5f * d, 7f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
    } else if ("resize-nwse".equals(type)) {
      c.save();
      c.rotate(45f, 12f * d, 12f * d);
      p.moveTo(2f * d, 12f * d);
      p.lineTo(7f * d, 7.5f * d);
      p.lineTo(7f * d, 10.5f * d);
      p.lineTo(17f * d, 10.5f * d);
      p.lineTo(17f * d, 7.5f * d);
      p.lineTo(22f * d, 12f * d);
      p.lineTo(17f * d, 16.5f * d);
      p.lineTo(17f * d, 13.5f * d);
      p.lineTo(7f * d, 13.5f * d);
      p.lineTo(7f * d, 16.5f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
      c.restore();
    } else if ("resize-nesw".equals(type)) {
      c.save();
      c.rotate(-45f, 12f * d, 12f * d);
      p.moveTo(2f * d, 12f * d);
      p.lineTo(7f * d, 7.5f * d);
      p.lineTo(7f * d, 10.5f * d);
      p.lineTo(17f * d, 10.5f * d);
      p.lineTo(17f * d, 7.5f * d);
      p.lineTo(22f * d, 12f * d);
      p.lineTo(17f * d, 16.5f * d);
      p.lineTo(17f * d, 13.5f * d);
      p.lineTo(7f * d, 13.5f * d);
      p.lineTo(7f * d, 16.5f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
      c.restore();
    } else {
      // Classic Windows arrow cursor
      p.moveTo(2f * d, 2f * d);
      p.lineTo(2f * d, 21f * d);
      p.lineTo(7f * d, 16.2f * d);
      p.lineTo(10.6f * d, 23.8f * d);
      p.lineTo(13.5f * d, 22.5f * d);
      p.lineTo(9.9f * d, 14.9f * d);
      p.lineTo(16.8f * d, 14.9f * d);
      p.close();
      c.drawPath(p, fill);
      c.drawPath(p, stroke);
    }

    return bmp;
  }

  // =========================================================================
  // WEBVIEW CONFIGURATION & CLIENTS
  // =========================================================================

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebViewSettings(WebView webView, boolean desktopMode, boolean incognito, int zoomPercent) {
    WebSettings ws = webView.getSettings();
    ws.setJavaScriptEnabled(true);
    ws.setDomStorageEnabled(true);
    ws.setDatabaseEnabled(!incognito);
    ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    ws.setMediaPlaybackRequiresUserGesture(false);
    ws.setAllowFileAccess(true);
    ws.setAllowContentAccess(true);
    ws.setJavaScriptCanOpenWindowsAutomatically(true);
    ws.setSupportMultipleWindows(true);
    ws.setUseWideViewPort(true);
    ws.setLoadWithOverviewMode(true);
    ws.setSupportZoom(true);
    ws.setBuiltInZoomControls(true);
    ws.setDisplayZoomControls(false);
    ws.setGeolocationEnabled(true);
    ws.setSaveFormData(!incognito);
    ws.setCacheMode(incognito ? WebSettings.LOAD_NO_CACHE : WebSettings.LOAD_DEFAULT);
    ws.setUserAgentString(desktopMode ? DESKTOP_USER_AGENT : MOBILE_USER_AGENT);
    ws.setTextZoom(Math.max(50, Math.min(250, zoomPercent)));

    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(webView, !incognito);
  }

  private void attachWebViewClients(WebViewEntry entry) {
    WebView wv = entry.webView;

    wv.setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null) return false;
        String url = uri.toString();
        String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";

        if (
          scheme.isEmpty() ||
          "http".equals(scheme) ||
          "https".equals(scheme) ||
          "about".equals(scheme) ||
          "data".equals(scheme) ||
          "blob".equals(scheme) ||
          "javascript".equals(scheme)
        ) {
          return false;
        }

        if ("intent".equals(scheme)) {
          try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
              intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
              getContext().startActivity(intent);
              return true;
            }
            String fallbackUrl = intent.getStringExtra("browser_fallback_url");
            if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
              view.loadUrl(fallbackUrl);
              return true;
            }
          } catch (Exception ignored) {}
          return true;
        }

        try {
          Intent externalIntent = new Intent(Intent.ACTION_VIEW, uri);
          externalIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getContext().startActivity(externalIntent);
        } catch (Exception ignored) {}
        return true;
      }

      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        entry.currentUrl = url != null ? url : entry.currentUrl;
        entry.progress = 10;

        JSObject startData = new JSObject();
        startData.put("id", entry.id);
        startData.put("url", entry.currentUrl);
        notifyListeners("loadStarted", startData);

        emitUrlChanged(entry, view);
      }

      @Override
      public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        super.doUpdateVisitedHistory(view, url, isReload);
        if (url != null) {
          entry.currentUrl = url;
          emitUrlChanged(entry, view);
        }
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (url != null) entry.currentUrl = url;
        String title = view.getTitle();
        if (title != null && !title.isEmpty()) {
          entry.currentTitle = title;
        }
        entry.progress = 100;

        if (!entry.incognito) {
          try {
            CookieManager.getInstance().flush();
          } catch (Exception ignored) {}
        }

        if (entry.zoomPercent != 100) {
          applyCssZoom(view, entry.zoomPercent);
        }

        JSObject finishData = new JSObject();
        finishData.put("id", entry.id);
        finishData.put("url", entry.currentUrl);
        finishData.put("title", entry.currentTitle);
        finishData.put("canGoBack", view.canGoBack());
        finishData.put("canGoForward", view.canGoForward());
        notifyListeners("loadFinished", finishData);

        emitUrlChanged(entry, view);
      }
    });

    wv.setWebChromeClient(new WebChromeClient() {
      @Override
      public void onProgressChanged(WebView view, int newProgress) {
        super.onProgressChanged(view, newProgress);
        entry.progress = newProgress;
        JSObject data = new JSObject();
        data.put("id", entry.id);
        data.put("progress", newProgress);
        notifyListeners("progressChanged", data);
      }

      @Override
      public void onReceivedTitle(WebView view, String title) {
        super.onReceivedTitle(view, title);
        if (title != null) {
          entry.currentTitle = title;
          JSObject data = new JSObject();
          data.put("id", entry.id);
          data.put("title", title);
          notifyListeners("titleChanged", data);
        }
      }

      @Override
      public void onReceivedIcon(WebView view, Bitmap icon) {
        super.onReceivedIcon(view, icon);
        if (icon == null) return;
        try {
          ByteArrayOutputStream baos = new ByteArrayOutputStream();
          icon.compress(Bitmap.CompressFormat.PNG, 90, baos);
          String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
          JSObject data = new JSObject();
          data.put("id", entry.id);
          data.put("favicon", "data:image/png;base64," + b64);
          notifyListeners("faviconReceived", data);
        } catch (Exception ignored) {}
      }

      @Override
      public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        WebView.HitTestResult result = view.getHitTestResult();
        String extraUrl = result != null ? result.getExtra() : null;
        if (extraUrl != null && (extraUrl.startsWith("http://") || extraUrl.startsWith("https://"))) {
          JSObject data = new JSObject();
          data.put("id", entry.id);
          data.put("url", extraUrl);
          notifyListeners("newWindowRequested", data);
          return false;
        }

        WebView tempWebView = new WebView(getContext());
        tempWebView.setWebViewClient(new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView tv, WebResourceRequest req) {
            if (req.getUrl() != null) {
              String targetUrl = req.getUrl().toString();
              JSObject data = new JSObject();
              data.put("id", entry.id);
              data.put("url", targetUrl);
              notifyListeners("newWindowRequested", data);
            }
            tv.destroy();
            return true;
          }
        });
        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(tempWebView);
        resultMsg.sendToTarget();
        return true;
      }

      @Override
      public boolean onShowFileChooser(
        WebView webView,
        ValueCallback<Uri[]> filePathCallback,
        FileChooserParams fileChooserParams
      ) {
        if (pendingFilePathCallback != null) {
          pendingFilePathCallback.onReceiveValue(null);
        }
        pendingFilePathCallback = filePathCallback;
        try {
          Intent intent = fileChooserParams.createIntent();
          if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
          }
          fileChooserLauncher.launch(intent);
          return true;
        } catch (ActivityNotFoundException ex) {
          pendingFilePathCallback = null;
          filePathCallback.onReceiveValue(null);
          return false;
        }
      }

      @Override
      public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        boolean hasFine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (hasFine || hasCoarse) {
          callback.invoke(origin, true, false);
          return;
        }
        if (pendingGeoCallback != null && pendingGeoOrigin != null) {
          pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
        }
        pendingGeoCallback = callback;
        pendingGeoOrigin = origin;
        geoPermissionLauncher.launch(new String[] {
          Manifest.permission.ACCESS_FINE_LOCATION,
          Manifest.permission.ACCESS_COARSE_LOCATION
        });
      }

      @Override
      public void onShowCustomView(View view, CustomViewCallback callback) {
        showCustomView(view, callback);
      }

      @Override
      public void onHideCustomView() {
        hideCustomView();
      }
    });

    wv.setDownloadListener(new DownloadListener() {
      @Override
      public void onDownloadStart(
        String url,
        String userAgent,
        String contentDisposition,
        String mimetype,
        long contentLength
      ) {
        String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
        if (filename == null || filename.isEmpty()) {
          filename = "download_" + System.currentTimeMillis();
        }

        if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
          try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            if (mimetype != null && !mimetype.isEmpty()) {
              req.setMimeType(mimetype);
            }
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null && !cookies.isEmpty()) {
              req.addRequestHeader("Cookie", cookies);
            }
            if (userAgent != null && !userAgent.isEmpty()) {
              req.addRequestHeader("User-Agent", userAgent);
            }
            req.setTitle(filename);
            req.setDescription("Downloading to Downloads folder");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
              dm.enqueue(req);
            }
          } catch (Exception ignored) {}
        }

        JSObject data = new JSObject();
        data.put("id", entry.id);
        data.put("url", url != null ? url : "");
        data.put("filename", filename);
        data.put("mimeType", mimetype != null ? mimetype : "application/octet-stream");
        data.put("contentLength", contentLength);
        data.put("timestamp", System.currentTimeMillis());
        notifyListeners("downloadStarted", data);
      }
    });

    wv.setFindListener((activeMatchOrdinal, numberOfMatches, isDoneCounting) -> {
      if (!isDoneCounting) return;
      JSObject data = new JSObject();
      data.put("id", entry.id);
      data.put("activeMatchOrdinal", activeMatchOrdinal);
      data.put("numberOfMatches", numberOfMatches);
      notifyListeners("findResults", data);
    });
  }

  private void emitUrlChanged(WebViewEntry entry, WebView view) {
    JSObject data = new JSObject();
    data.put("id", entry.id);
    data.put("url", entry.currentUrl);
    data.put("canGoBack", view.canGoBack());
    data.put("canGoForward", view.canGoForward());
    notifyListeners("urlChanged", data);
  }

  private void showCustomView(View view, WebChromeClient.CustomViewCallback callback) {
    if (customView != null) {
      callback.onCustomViewHidden();
      return;
    }
    Activity activity = getActivity();
    if (activity == null) return;
    customView = view;
    customViewCallback = callback;

    fullscreenContainer = new FrameLayout(activity);
    fullscreenContainer.setBackgroundColor(Color.BLACK);
    fullscreenContainer.addView(
      view,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );

    ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
    decor.addView(
      fullscreenContainer,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    bringCursorToFront();
  }

  private void hideCustomView() {
    if (customView == null) return;
    Activity activity = getActivity();
    if (activity != null && fullscreenContainer != null) {
      ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
      decor.removeView(fullscreenContainer);
      if (activity instanceof MainActivity) {
        ((MainActivity) activity).applyImmersiveAndKeepAwake();
      }
    }
    fullscreenContainer = null;
    customView = null;
    if (customViewCallback != null) {
      customViewCallback.onCustomViewHidden();
      customViewCallback = null;
    }
    bringCursorToFront();
  }

  private void applyCssZoom(WebView wv, int zoomPercent) {
    wv.getSettings().setTextZoom(Math.max(50, Math.min(250, zoomPercent)));
    String jsZoom = zoomPercent == 100
      ? "if (document && document.documentElement) { document.documentElement.style.zoom = ''; }"
      : "if (document && document.documentElement) { document.documentElement.style.zoom = '" + (zoomPercent / 100.0) + "'; }";
    wv.evaluateJavascript(jsZoom, null);
  }

  private void cleanupWebView(WebViewEntry entry) {
    if (entry == null) return;
    try {
      if (entry.pendingLongPressUp != null) {
        entry.webView.removeCallbacks(entry.pendingLongPressUp);
        entry.pendingLongPressUp = null;
      }
      if (entry.incognito) {
        entry.webView.clearCache(true);
        entry.webView.clearFormData();
        entry.webView.clearHistory();
      }
      entry.webView.stopLoading();
      entry.webView.setDownloadListener(null);
      entry.webView.setWebChromeClient(null);
      entry.webView.setWebViewClient(new WebViewClient());
      if (entry.webView.getParent() instanceof ViewGroup) {
        ((ViewGroup) entry.webView.getParent()).removeView(entry.webView);
      }
      entry.webView.destroy();
    } catch (Exception ignored) {}
  }

  // =========================================================================
  // EMBEDDED WEBVIEW PLUGIN METHODS
  // =========================================================================

  @PluginMethod
  public void create(PluginCall call) {
    String id = call.getString("id");
    String url = call.getString("url", "about:blank");
    double x = call.getDouble("x", 0.0);
    double y = call.getDouble("y", 0.0);
    double width = call.getDouble("width", 400.0);
    double height = call.getDouble("height", 300.0);
    Double dpr = call.getDouble("devicePixelRatio");
    boolean desktopMode = Boolean.TRUE.equals(call.getBoolean("desktopMode", false));
    boolean incognito = Boolean.TRUE.equals(call.getBoolean("incognito", false));
    int zoom = call.getInt("zoom", 100);
    boolean visible = Boolean.TRUE.equals(call.getBoolean("visible", true));

    if (id == null || id.isEmpty()) {
      call.reject("id is required");
      return;
    }

    getBridge().executeOnMainThread(() -> {
      ensureOverlayContainer();
      if (webViews.containsKey(id)) {
        zOrderIds.remove(id);
        cleanupWebView(webViews.remove(id));
      }

      WebView wv = new WebView(getContext());
      wv.setBackgroundColor(Color.WHITE);
      WebViewEntry entry = new WebViewEntry(id, wv, incognito, desktopMode);
      entry.cssX = x;
      entry.cssY = y;
      entry.cssWidth = width;
      entry.cssHeight = height;
      entry.cssDpr = dpr != null && dpr > 0 ? dpr : 0;
      entry.zoomPercent = zoom;
      entry.visible = visible;
      entry.currentUrl = url != null ? url : "about:blank";

      configureWebViewSettings(wv, desktopMode, incognito, zoom);
      attachWebViewClients(entry);

      if (overlayContainer != null) {
        int insertIndex = touchInterceptorView != null && touchInterceptorView.getParent() == overlayContainer
          ? overlayContainer.indexOfChild(touchInterceptorView)
          : overlayContainer.getChildCount();
        overlayContainer.addView(wv, Math.max(0, insertIndex));
        zOrderIds.remove(id);
        zOrderIds.add(id);
        applyLayoutParams(entry);
      }

      webViews.put(id, entry);
      if (url != null && !url.isEmpty() && !"about:blank".equals(url)) {
        wv.loadUrl(url);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setBounds(PluginCall call) {
    String id = call.getString("id");
    if (id == null) {
      call.reject("id is required");
      return;
    }
    double x = call.getDouble("x", 0.0);
    double y = call.getDouble("y", 0.0);
    double width = call.getDouble("width", 0.0);
    double height = call.getDouble("height", 0.0);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = webViews.get(id);
      if (entry != null) {
        entry.cssX = x;
        entry.cssY = y;
        entry.cssWidth = width;
        entry.cssHeight = height;
        if (dpr != null && dpr > 0) {
          entry.cssDpr = dpr;
        }
        applyLayoutParams(entry);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void loadUrl(PluginCall call) {
    String id = call.getString("id");
    String url = call.getString("url");
    if (id == null || url == null) {
      call.reject("id and url are required");
      return;
    }
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = webViews.get(id);
      if (entry != null) {
        entry.currentUrl = url;
        entry.webView.loadUrl(url);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void goBack(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      boolean handled = false;
      if (entry != null && entry.webView.canGoBack()) {
        entry.webView.goBack();
        handled = true;
      }
      JSObject res = new JSObject();
      res.put("handled", handled);
      call.resolve(res);
    });
  }

  @PluginMethod
  public void goForward(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      boolean handled = false;
      if (entry != null && entry.webView.canGoForward()) {
        entry.webView.goForward();
        handled = true;
      }
      JSObject res = new JSObject();
      res.put("handled", handled);
      call.resolve(res);
    });
  }

  @PluginMethod
  public void reload(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.webView.reload();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void stop(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.webView.stopLoading();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void show(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.visible = true;
        zOrderIds.remove(id);
        zOrderIds.add(id);
        applyLayoutParams(entry);
        entry.webView.bringToFront();
        if (touchInterceptorView != null && mouseModeTouchIntercept) {
          touchInterceptorView.bringToFront();
        }
        bringCursorToFront();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void hide(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.visible = false;
        entry.webView.setVisibility(View.GONE);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void destroy(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      if (id != null && webViews.containsKey(id)) {
        zOrderIds.remove(id);
        cleanupWebView(webViews.remove(id));
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setDesktopMode(PluginCall call) {
    String id = call.getString("id");
    boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.desktopMode = enabled;
        entry.webView.getSettings().setUserAgentString(enabled ? DESKTOP_USER_AGENT : MOBILE_USER_AGENT);
        entry.webView.reload();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setZoom(PluginCall call) {
    String id = call.getString("id");
    int zoom = call.getInt("zoom", 100);
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        entry.zoomPercent = Math.max(50, Math.min(250, zoom));
        applyCssZoom(entry.webView, entry.zoomPercent);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void findInPage(PluginCall call) {
    String id = call.getString("id");
    String query = call.getString("query", "");
    boolean forward = Boolean.TRUE.equals(call.getBoolean("forward", true));
    boolean clear = Boolean.TRUE.equals(call.getBoolean("clear", false));
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      if (entry != null) {
        if (clear || query == null || query.isEmpty()) {
          entry.lastFindQuery = "";
          entry.webView.clearMatches();
        } else if (!query.equals(entry.lastFindQuery)) {
          entry.lastFindQuery = query;
          entry.webView.findAllAsync(query);
        } else {
          entry.webView.findNext(forward);
        }
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void getState(PluginCall call) {
    String id = call.getString("id");
    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = id != null ? webViews.get(id) : null;
      JSObject res = new JSObject();
      if (entry != null) {
        res.put("canGoBack", entry.webView.canGoBack());
        res.put("canGoForward", entry.webView.canGoForward());
        res.put("url", entry.webView.getUrl() != null ? entry.webView.getUrl() : entry.currentUrl);
        res.put("title", entry.webView.getTitle() != null ? entry.webView.getTitle() : entry.currentTitle);
        res.put("progress", entry.progress);
      } else {
        res.put("canGoBack", false);
        res.put("canGoForward", false);
        res.put("url", "");
        res.put("title", "");
        res.put("progress", 0);
      }
      call.resolve(res);
    });
  }

  @PluginMethod
  public void clearData(PluginCall call) {
    getBridge().executeOnMainThread(() -> {
      try {
        CookieManager.getInstance().removeAllCookies(null);
        CookieManager.getInstance().flush();
        WebStorage.getInstance().deleteAllData();
        for (WebViewEntry entry : webViews.values()) {
          entry.webView.clearCache(true);
          entry.webView.clearFormData();
          entry.webView.clearHistory();
        }
      } catch (Exception ignored) {}
      call.resolve();
    });
  }

  // =========================================================================
  // NATIVE CURSOR & TOUCH INTERCEPTOR METHODS
  // =========================================================================

  @PluginMethod
  public void showCursor(PluginCall call) {
    Double x = call.getDouble("x");
    Double y = call.getDouble("y");
    Double dpr = call.getDouble("devicePixelRatio");
    String type = call.getString("type");
    getBridge().executeOnMainThread(() -> {
      ensureCursorView();
      cursorVisible = true;
      if (x != null) cursorCssX = x;
      if (y != null) cursorCssY = y;
      if (dpr != null && dpr > 0) cursorDpr = dpr;
      if (type != null && !type.isEmpty()) {
        applyCursorBitmap(type);
      }
      if (cursorView != null) {
        cursorView.setVisibility(View.VISIBLE);
        updateCursorTranslation();
        bringCursorToFront();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void hideCursor(PluginCall call) {
    getBridge().executeOnMainThread(() -> {
      cursorVisible = false;
      if (cursorView != null) {
        cursorView.setVisibility(View.GONE);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void moveCursor(PluginCall call) {
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");
    getBridge().executeOnMainThread(() -> {
      cursorCssX = x;
      cursorCssY = y;
      if (dpr != null && dpr > 0) cursorDpr = dpr;
      if (cursorView == null && cursorVisible) {
        ensureCursorView();
      }
      if (cursorView != null && cursorVisible) {
        if (cursorView.getVisibility() != View.VISIBLE) {
          cursorView.setVisibility(View.VISIBLE);
        }
        updateCursorTranslation();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setCursorStyle(PluginCall call) {
    String type = call.getString("type", "arrow");
    getBridge().executeOnMainThread(() -> {
      if (cursorView == null && cursorVisible) {
        ensureCursorView();
      }
      if (!type.equals(cursorType)) {
        applyCursorBitmap(type);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void setMouseModeTouchIntercept(PluginCall call) {
    boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    getBridge().executeOnMainThread(() -> {
      mouseModeTouchIntercept = enabled;
      forwardingTouchStream = false;
      ensureOverlayContainer();
      if (touchInterceptorView != null) {
        touchInterceptorView.setVisibility(enabled ? View.VISIBLE : View.GONE);
        if (enabled) {
          touchInterceptorView.bringToFront();
        }
      }
      bringCursorToFront();
      call.resolve();
    });
  }

  // =========================================================================
  // NATIVE MOTION EVENT INJECTION INTO EMBEDDED WEBVIEW
  // =========================================================================

  private WebViewEntry resolveTargetEntry(String id, double cssX, double cssY) {
    if (id != null && !id.isEmpty()) {
      WebViewEntry e = webViews.get(id);
      if (e != null && e.visible && e.webView.getVisibility() == View.VISIBLE) {
        return e;
      }
    }
    for (int i = zOrderIds.size() - 1; i >= 0; i--) {
      WebViewEntry entry = webViews.get(zOrderIds.get(i));
      if (entry != null && entry.visible && entry.webView.getVisibility() == View.VISIBLE) {
        if (
          cssX >= entry.cssX &&
          cssX <= entry.cssX + entry.cssWidth &&
          cssY >= entry.cssY &&
          cssY <= entry.cssY + entry.cssHeight
        ) {
          return entry;
        }
      }
    }
    return null;
  }

  private float[] toLocalPixels(WebViewEntry entry, double cssX, double cssY, Double dprOpt) {
    float dpr = dprOpt != null && dprOpt > 0
      ? dprOpt.floatValue()
      : (entry.cssDpr > 0 ? (float) entry.cssDpr : getContext().getResources().getDisplayMetrics().density);
    if (dpr <= 0f) dpr = 1f;
    float lx = (float) ((cssX - entry.cssX) * dpr);
    float ly = (float) ((cssY - entry.cssY) * dpr);
    int w = Math.max(2, entry.webView.getWidth());
    int h = Math.max(2, entry.webView.getHeight());
    lx = Math.max(1f, Math.min(w - 1f, lx));
    ly = Math.max(1f, Math.min(h - 1f, ly));
    return new float[] { lx, ly };
  }

  private void dispatchTouchPoint(WebView wv, long downTime, long eventTime, int action, float x, float y) {
    MotionEvent ev = MotionEvent.obtain(downTime, eventTime, action, x, y, 0);
    ev.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    wv.dispatchTouchEvent(ev);
    ev.recycle();
  }

  @PluginMethod
  public void injectTap(PluginCall call) {
    String id = call.getString("id");
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        float[] pt = toLocalPixels(entry, x, y, dpr);
        entry.webView.requestFocus();
        long now = SystemClock.uptimeMillis();
        dispatchTouchPoint(entry.webView, now, now, MotionEvent.ACTION_DOWN, pt[0], pt[1]);
        dispatchTouchPoint(entry.webView, now, now + 24, MotionEvent.ACTION_UP, pt[0], pt[1]);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectDoubleTap(PluginCall call) {
    String id = call.getString("id");
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        float[] pt = toLocalPixels(entry, x, y, dpr);
        entry.webView.requestFocus();
        long t1 = SystemClock.uptimeMillis();
        dispatchTouchPoint(entry.webView, t1, t1, MotionEvent.ACTION_DOWN, pt[0], pt[1]);
        dispatchTouchPoint(entry.webView, t1, t1 + 20, MotionEvent.ACTION_UP, pt[0], pt[1]);
        entry.webView.postDelayed(() -> {
          long t2 = SystemClock.uptimeMillis();
          dispatchTouchPoint(entry.webView, t2, t2, MotionEvent.ACTION_DOWN, pt[0], pt[1]);
          dispatchTouchPoint(entry.webView, t2, t2 + 20, MotionEvent.ACTION_UP, pt[0], pt[1]);
        }, 65);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectLongPress(PluginCall call) {
    String id = call.getString("id");
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        if (entry.pendingLongPressUp != null) {
          entry.webView.removeCallbacks(entry.pendingLongPressUp);
          entry.pendingLongPressUp = null;
        }
        float[] pt = toLocalPixels(entry, x, y, dpr);
        entry.webView.requestFocus();
        long downTime = SystemClock.uptimeMillis();
        dispatchTouchPoint(entry.webView, downTime, downTime, MotionEvent.ACTION_DOWN, pt[0], pt[1]);
        int holdMs = ViewConfiguration.getLongPressTimeout() + 80;
        Runnable upTask = () -> {
          dispatchTouchPoint(entry.webView, downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, pt[0], pt[1]);
          entry.pendingLongPressUp = null;
        };
        entry.pendingLongPressUp = upTask;
        entry.webView.postDelayed(upTask, holdMs);
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectDrag(PluginCall call) {
    String id = call.getString("id");
    String phase = call.getString("phase", "move");
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        if (entry.pendingLongPressUp != null) {
          entry.webView.removeCallbacks(entry.pendingLongPressUp);
          entry.pendingLongPressUp = null;
        }
        float[] pt = toLocalPixels(entry, x, y, dpr);
        long now = SystemClock.uptimeMillis();
        if ("start".equals(phase)) {
          entry.webView.requestFocus();
          entry.dragDownTime = now;
          dispatchTouchPoint(entry.webView, entry.dragDownTime, now, MotionEvent.ACTION_DOWN, pt[0], pt[1]);
        } else if ("move".equals(phase)) {
          if (entry.dragDownTime <= 0) entry.dragDownTime = now;
          dispatchTouchPoint(entry.webView, entry.dragDownTime, now, MotionEvent.ACTION_MOVE, pt[0], pt[1]);
        } else {
          if (entry.dragDownTime > 0) {
            dispatchTouchPoint(entry.webView, entry.dragDownTime, now, MotionEvent.ACTION_UP, pt[0], pt[1]);
            entry.dragDownTime = 0;
          }
        }
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectScroll(PluginCall call) {
    String id = call.getString("id");
    double dx = call.getDouble("dx", 0.0);
    double dy = call.getDouble("dy", 0.0);
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        float[] pt = toLocalPixels(entry, x, y, dpr);
        long now = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties[] props = new MotionEvent.PointerProperties[1];
        props[0] = new MotionEvent.PointerProperties();
        props[0].id = 0;
        props[0].toolType = MotionEvent.TOOL_TYPE_MOUSE;

        MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[1];
        coords[0] = new MotionEvent.PointerCoords();
        coords[0].x = pt[0];
        coords[0].y = pt[1];
        coords[0].setAxisValue(MotionEvent.AXIS_VSCROLL, (float) (dy / 18.0));
        coords[0].setAxisValue(MotionEvent.AXIS_HSCROLL, (float) (-dx / 18.0));

        MotionEvent ev = MotionEvent.obtain(
          now,
          now,
          MotionEvent.ACTION_SCROLL,
          1,
          props,
          coords,
          0,
          0,
          1f,
          1f,
          0,
          0,
          InputDevice.SOURCE_MOUSE,
          0
        );
        entry.webView.dispatchGenericMotionEvent(ev);
        ev.recycle();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectHover(PluginCall call) {
    String id = call.getString("id");
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);
    Double dpr = call.getDouble("devicePixelRatio");

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      if (entry != null) {
        float[] pt = toLocalPixels(entry, x, y, dpr);
        long now = SystemClock.uptimeMillis();
        MotionEvent ev = MotionEvent.obtain(now, now, MotionEvent.ACTION_HOVER_MOVE, pt[0], pt[1], 0);
        ev.setSource(InputDevice.SOURCE_MOUSE);
        entry.webView.dispatchGenericMotionEvent(ev);
        ev.recycle();
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void injectPinch(PluginCall call) {
    String id = call.getString("id");
    double scaleDelta = call.getDouble("scaleDelta", 1.0);
    double x = call.getDouble("x", cursorCssX);
    double y = call.getDouble("y", cursorCssY);

    getBridge().executeOnMainThread(() -> {
      WebViewEntry entry = resolveTargetEntry(id, x, y);
      int nextZoom = 100;
      if (entry != null && scaleDelta > 0.2) {
        nextZoom = Math.max(50, Math.min(250, (int) Math.round(entry.zoomPercent * scaleDelta)));
        if (nextZoom != entry.zoomPercent) {
          entry.zoomPercent = nextZoom;
          applyCssZoom(entry.webView, entry.zoomPercent);
        }
      }
      JSObject res = new JSObject();
      res.put("zoom", nextZoom);
      call.resolve(res);
    });
  }

  // =========================================================================
  // IN-APP APK UPDATER METHODS
  // =========================================================================

  @PluginMethod
  public void getAppVersion(PluginCall call) {
    try {
      Context ctx = getContext();
      PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
      long versionCode = PackageInfoCompat.getLongVersionCode(pi);
      JSObject res = new JSObject();
      res.put("versionCode", versionCode);
      res.put("versionName", pi.versionName != null ? pi.versionName : "1.0.0");
      res.put("packageName", ctx.getPackageName());
      call.resolve(res);
    } catch (Exception e) {
      call.reject("Failed to read package info: " + e.getMessage());
    }
  }

  @PluginMethod
  public void openInstallPermissionSettings(PluginCall call) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Activity not available");
      return;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Intent intent = new Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + activity.getPackageName())
      );
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity.startActivity(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void installPendingUpdate(PluginCall call) {
    if (pendingUpdateApkFile == null || !pendingUpdateApkFile.exists()) {
      call.reject("No downloaded APK update found");
      return;
    }
    boolean launched = launchApkInstaller(pendingUpdateApkFile);
    JSObject res = new JSObject();
    res.put("launched", launched);
    res.put("needsPermission", !launched);
    call.resolve(res);
  }

  @PluginMethod
  public void downloadAndInstallUpdate(PluginCall call) {
    String url = call.getString("url");
    String filename = call.getString("filename", "Win10Simulator-update.apk");
    if (url == null || url.isEmpty()) {
      call.reject("url is required");
      return;
    }

    Context ctx = getContext();
    DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
    if (dm == null) {
      call.reject("DownloadManager unavailable");
      return;
    }

    try {
      File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      if (dir != null && !dir.exists()) {
        dir.mkdirs();
      }
      File destFile = new File(dir, filename);
      if (destFile.exists()) {
        destFile.delete();
      }
      pendingUpdateApkFile = destFile;

      unregisterUpdateReceiver();

      DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
      req.setTitle("Win10 Simulator Update");
      req.setDescription("Downloading latest APK build...");
      req.setMimeType("application/vnd.android.package-archive");
      req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      req.setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, filename);

      activeUpdateDownloadId = dm.enqueue(req);
      emitUpdateStatus("downloading", 0, "Downloading update package...");

      updateDownloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          long finishedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
          if (finishedId != activeUpdateDownloadId) return;
          stopUpdateProgressPoller();
          unregisterUpdateReceiver();

          DownloadManager.Query q = new DownloadManager.Query();
          q.setFilterById(activeUpdateDownloadId);
          Cursor cursor = dm.query(q);
          boolean success = false;
          String reasonText = "Download failed";
          if (cursor != null) {
            if (cursor.moveToFirst()) {
              int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
              int status = statusIdx >= 0 ? cursor.getInt(statusIdx) : -1;
              success = (status == DownloadManager.STATUS_SUCCESSFUL);
              if (!success) {
                int reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                int reason = reasonIdx >= 0 ? cursor.getInt(reasonIdx) : 0;
                reasonText = "Download failed (code " + reason + ")";
              }
            }
            cursor.close();
          }

          if (success && pendingUpdateApkFile != null && pendingUpdateApkFile.exists()) {
            boolean launched = launchApkInstaller(pendingUpdateApkFile);
            if (launched) {
              emitUpdateStatus("installing", 100, "Opening Android installer...");
            } else {
              emitUpdateStatus("needs_permission", 100, "Allow 'Install unknown apps' for Win10 Simulator, then tap Install.");
            }
          } else {
            emitUpdateStatus("error", 0, reasonText);
          }
        }
      };

      IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
      ContextCompat.registerReceiver(ctx, updateDownloadReceiver, filter, ContextCompat.RECEIVER_EXPORTED);

      startUpdateProgressPoller(dm, activeUpdateDownloadId);
      call.resolve();
    } catch (Exception e) {
      stopUpdateProgressPoller();
      unregisterUpdateReceiver();
      emitUpdateStatus("error", 0, e.getMessage() != null ? e.getMessage() : "Update failed");
      call.reject("Failed to start update download: " + e.getMessage());
    }
  }

  private void startUpdateProgressPoller(DownloadManager dm, long downloadId) {
    stopUpdateProgressPoller();
    updateProgressPoller = new Runnable() {
      @Override
      public void run() {
        if (downloadId <= 0) return;
        try {
          DownloadManager.Query q = new DownloadManager.Query();
          q.setFilterById(downloadId);
          Cursor c = dm.query(q);
          if (c != null) {
            if (c.moveToFirst()) {
              int downloadedIdx = c.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
              int totalIdx = c.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
              long dl = downloadedIdx >= 0 ? c.getLong(downloadedIdx) : 0;
              long total = totalIdx >= 0 ? c.getLong(totalIdx) : 0;
              int pct = total > 0 ? (int) Math.min(99, (dl * 100L) / total) : 0;
              emitUpdateStatus("downloading", pct, "Downloading update... " + pct + "%");
            }
            c.close();
          }
        } catch (Exception ignored) {}
        mainHandler.postDelayed(this, 350);
      }
    };
    mainHandler.postDelayed(updateProgressPoller, 350);
  }

  private void stopUpdateProgressPoller() {
    if (updateProgressPoller != null) {
      mainHandler.removeCallbacks(updateProgressPoller);
      updateProgressPoller = null;
    }
  }

  private void unregisterUpdateReceiver() {
    if (updateDownloadReceiver != null) {
      try {
        getContext().unregisterReceiver(updateDownloadReceiver);
      } catch (Exception ignored) {}
      updateDownloadReceiver = null;
    }
  }

  private void emitUpdateStatus(String status, int progress, String message) {
    JSObject data = new JSObject();
    data.put("status", status);
    data.put("progress", progress);
    data.put("message", message);
    notifyListeners("updateStatus", data);
  }

  private boolean launchApkInstaller(File apkFile) {
    Context ctx = getContext();
    Activity activity = getActivity();
    if (ctx == null || activity == null || apkFile == null || !apkFile.exists()) return false;

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (!ctx.getPackageManager().canRequestPackageInstalls()) {
        Intent permIntent = new Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + ctx.getPackageName())
        );
        permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(permIntent);
        return false;
      }
    }

    Uri apkUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apkFile);
    Intent installIntent = new Intent(Intent.ACTION_VIEW);
    installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
    installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    activity.startActivity(installIntent);
    return true;
  }
}
