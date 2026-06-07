package com.bondhu.app.data.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/** Records mic audio to AAC/m4a (minSdk-26 safe). Backend ffmpeg auto-detects
 *  and transcodes, so the container/codec just needs to be a real audio file. */
@Singleton
class VoiceRecorder @Inject constructor(@ApplicationContext private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var outFile: File? = null
    var startedAtMs: Long = 0; private set

    fun start(nowMs: Long) {
        stopQuietly()
        val f = File(context.cacheDir, "rec_${nowMs}.m4a")
        val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
        r.setAudioSource(MediaRecorder.AudioSource.MIC)
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioSamplingRate(44100); r.setAudioEncodingBitRate(96000)
        r.setOutputFile(f.absolutePath)
        r.prepare(); r.start()
        recorder = r; outFile = f; startedAtMs = nowMs
    }

    /** Stop and return (base64, mimeType) or null if nothing recorded. */
    fun stop(): Pair<String, String>? {
        val r = recorder ?: return null
        return try {
            r.stop()
            val f = outFile
            if (f != null && f.exists() && f.length() > 0) Base64.encodeToString(f.readBytes(), Base64.NO_WRAP) to "audio/mp4" else null
        } catch (_: Exception) { null } finally { releaseRecorder() }
    }

    fun cancel() { stopQuietly(); outFile?.delete() }
    private fun stopQuietly() { try { recorder?.stop() } catch (_: Exception) {}; releaseRecorder() }
    private fun releaseRecorder() { try { recorder?.release() } catch (_: Exception) {}; recorder = null }
}
