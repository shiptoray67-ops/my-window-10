package com.win10.simulator;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Message;
import android.util.Base64;
import android.view.View;
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
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.lang.ref.WeakReference;
import java.util.HashMap;
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

    WebViewEntry(String id, WebView webView, boolean incognito, boolean desktopMode) {
      this.id = id;
      this.webView = webView;
      this.incognito = incognito;
      this.desktopMode = desktopMode;
    }
  }

  private final Map<String, WebViewEntry> webViews = new HashMap<>();
  private FrameLayout overlayContainer;
  private FrameLayout fullscreenContainer;
  private View customView;
  private WebChromeClient.CustomViewCallback customViewCallback;

  private ActivityResultLauncher<Intent> fileChooserLauncher;
  private ValueCallback<Uri[]> pendingFilePathCallback;

  private ActivityResultLauncher<String[]> geoPermissionLauncher;
  private GeolocationPermissions.Callback pendingGeoCallback;
  private String pendingGeoOrigin;

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
    if (getBridge() != null) {
      getBridge().executeOnMainThread(() -> {
        for (WebViewEntry entry : webViews.values()) {
          cleanupWebView(entry);
        }
        webViews.clear();
      });
    }
  }

  public boolean handleBackPressed() {
    if (customView != null) {
      hideCustomView();
      return true;
    }
    for (WebViewEntry entry : webViews.values()) {
      if (entry.visible && entry.webView.getVisibility() == View.VISIBLE && entry.webView.canGoBack()) {
        entry.webView.goBack();
        return true;
      }
    }
    return false;
  }

  private void ensureOverlayContainer() {
    if (overlayContainer != null && overlayContainer.getParent() != null) return;
    WebView capWebView = getBridge().getWebView();
    if (capWebView == null || !(capWebView.getParent() instanceof ViewGroup)) return;
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
  }

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
        overlayContainer.addView(wv);
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
        applyLayoutParams(entry);
        entry.webView.bringToFront();
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
}
