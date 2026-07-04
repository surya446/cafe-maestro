package com.cafemaestro.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * ApkUpdaterPlugin — downloads an APK with progress events and launches
 * the Android package installer via a FileProvider URI.
 *
 * Capacitor has no built-in plugin for this, so it is implemented natively
 * here. Used exclusively by the in-app "Update Available" flow on Android
 * (see src/native/apkUpdater.ts, src/hooks/useApkDownload.ts).
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "cafe-maestro-update.apk");

        if (url == null || url.isEmpty()) {
            call.reject("Missing 'url' parameter");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                File outFile = new File(getContext().getExternalCacheDir(), fileName);
                URL downloadUrl = new URL(url);
                connection = (HttpURLConnection) downloadUrl.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.connect();

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    call.reject("Server returned HTTP " + connection.getResponseCode());
                    return;
                }

                int totalBytes = connection.getContentLength();
                long bytesWritten = 0;
                long lastEmit = 0;

                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(outFile)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        bytesWritten += read;

                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 120 || bytesWritten == totalBytes) {
                            lastEmit = now;
                            JSObject progress = new JSObject();
                            double percent = totalBytes > 0 ? (bytesWritten * 100.0 / totalBytes) : -1;
                            progress.put("percent", percent);
                            progress.put("bytesWritten", bytesWritten);
                            progress.put("totalBytes", totalBytes);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                }

                JSObject ret = new JSObject();
                ret.put("path", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing 'path' parameter");
            return;
        }

        try {
            File apkFile = new File(path);
            if (!apkFile.exists()) {
                call.reject("APK file not found at path: " + path);
                return;
            }

            Uri apkUri;
            Intent intent = new Intent(Intent.ACTION_VIEW);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apkFile
                );
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                apkUri = Uri.fromFile(apkFile);
            }

            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            call.resolve();
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage(), e);
        }
    }
}
