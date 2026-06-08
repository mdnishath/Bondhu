package com.bondhu.app.data.update

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import com.bondhu.app.BuildConfig
import com.bondhu.app.data.api.BondhuApi
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class UpdateInfo(val versionName: String, val url: String, val notes: String)

/** Checks GitHub (via the backend) for a newer APK and downloads it via the system
 *  DownloadManager — the completed notification opens the installer (1-tap update). */
@Singleton
class UpdateManager @Inject constructor(
    @ApplicationContext private val ctx: Context,
    private val api: BondhuApi,
) {
    val currentVersion: String get() = BuildConfig.VERSION_NAME

    /** Returns update info if a newer version exists, else null. */
    suspend fun check(): UpdateInfo? {
        val r = runCatching { api.latestVersion() }.getOrNull() ?: return null
        val v = r.versionName ?: return null
        val url = r.url ?: return null
        return if (isNewer(v, BuildConfig.VERSION_NAME)) UpdateInfo(v, url, r.notes ?: "") else null
    }

    /** Enqueue the APK download; the system notification lets the user install it. */
    fun startDownload(info: UpdateInfo) {
        try {
            val req = DownloadManager.Request(Uri.parse(info.url))
                .setTitle("Bondhu ${info.versionName}")
                .setDescription("Downloading update…")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Bondhu-${info.versionName}.apk")
            (ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
        } catch (_: Exception) { /* ignore */ }
    }

    /** True if [remote] semver is greater than [local] (numeric, dot-separated). */
    private fun isNewer(remote: String, local: String): Boolean {
        fun parts(s: String) = s.trim().split(".").map { seg -> seg.filter { it.isDigit() }.toIntOrNull() ?: 0 }
        val a = parts(remote); val b = parts(local)
        for (i in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(i) { 0 }; val y = b.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }
}
