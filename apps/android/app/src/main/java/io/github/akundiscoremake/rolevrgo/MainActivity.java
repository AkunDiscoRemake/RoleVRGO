package io.github.akundiscoremake.rolevrgo;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.util.ArrayList;
import java.util.List;

/** RoleVRGO: abre o jogo (sempre a versão mais nova do site) em tela cheia, com câmera, microfone e sensores. */
public class MainActivity extends Activity {
  private static final String URL = "https://akundiscoremake.github.io/RoleVRGO/";
  private static final String HOST = "akundiscoremake.github.io";
  private WebView web;
  private PermissionRequest pendente;
  private ValueCallback<Uri[]> arquivos;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    web = new WebView(this);
    setContentView(web);
    telaCheia();
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setAllowFileAccess(false);
    s.setUserAgentString(s.getUserAgentString() + " RoleVRGOApp/1.1");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/RoleVRGO") && !u.getPath().startsWith("/RoleVRGO/docs")) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
        return true; // links de fora (docs, GitHub) abrem no navegador
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest req) { runOnUiThread(() -> pedir(req)); }
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
        if (arquivos != null) arquivos.onReceiveValue(null);
        arquivos = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
        try { startActivityForResult(Intent.createChooser(i, "Escolher arquivo"), 7); } catch (Exception e) { arquivos = null; return false; }
        return true;
      }
    });
    web.setDownloadListener((url, ua, cd, mime, len) -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { } });
    if (b != null) web.restoreState(b); else web.loadUrl(URL);
  }

  // câmera (marcador +, mãos) e microfone (chat de voz): pede a permissão do Android e libera para a página
  private void pedir(PermissionRequest req) {
    List<String> faltam = new ArrayList<>();
    for (String r : req.getResources()) {
      if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) faltam.add(Manifest.permission.CAMERA);
      if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) faltam.add(Manifest.permission.RECORD_AUDIO);
    }
    if (faltam.isEmpty()) { req.grant(req.getResources()); return; }
    pendente = req; requestPermissions(faltam.toArray(new String[0]), 5);
  }
  @Override public void onRequestPermissionsResult(int code, String[] p, int[] r) {
    if (code != 5 || pendente == null) return;
    boolean ok = true; for (int x : r) if (x != PackageManager.PERMISSION_GRANTED) ok = false;
    if (ok) pendente.grant(pendente.getResources()); else pendente.deny();
    pendente = null;
  }
  @Override protected void onActivityResult(int code, int res, Intent data) {
    if (code == 7 && arquivos != null) {
      Uri[] r = null;
      if (res == RESULT_OK && data != null) {
        if (data.getClipData() != null) { r = new Uri[data.getClipData().getItemCount()]; for (int i = 0; i < r.length; i++) r[i] = data.getClipData().getItemAt(i).getUri(); }
        else if (data.getData() != null) r = new Uri[] { data.getData() };
      }
      arquivos.onReceiveValue(r); arquivos = null;
    }
  }
  private void telaCheia() {
    web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }
  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) telaCheia(); }
  @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
  @Override protected void onPause() { super.onPause(); web.onPause(); }
  @Override protected void onResume() { super.onResume(); web.onResume(); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
