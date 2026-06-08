package com.bondhu.app.data.audio

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class Playback(val id: String? = null, val isPlaying: Boolean = false, val positionMs: Long = 0, val durationMs: Long = 0, val speed: Float = 1f)

@Singleton
class AudioPlayer @Inject constructor(@ApplicationContext private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private val _state = MutableStateFlow(Playback())
    val state: StateFlow<Playback> = _state
    private var player: ExoPlayer? = null
    private var currentId: String? = null
    private var speed = 1f
    private val ticker = object : Runnable {
        override fun run() {
            val p = player ?: return
            _state.value = Playback(currentId, p.isPlaying, p.currentPosition.coerceAtLeast(0), p.duration.coerceAtLeast(0), speed)
            if (p.isPlaying) main.postDelayed(this, 250)
        }
    }

    /** Cycle playback speed 1x → 1.5x → 2x → 1x; applies live to the active clip. */
    fun cycleSpeed() = main.post {
        speed = when (speed) { 1f -> 1.5f; 1.5f -> 2f; else -> 1f }
        player?.setPlaybackSpeed(speed)
        _state.value = _state.value.copy(speed = speed)
    }

    private fun ensurePlayer(): ExoPlayer {
        if (player == null) {
            player = ExoPlayer.Builder(context).setLooper(Looper.getMainLooper()).build().also { pl ->
                pl.addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _state.value = _state.value.copy(isPlaying = isPlaying)
                        if (isPlaying) main.post(ticker)
                    }
                    override fun onPlaybackStateChanged(s: Int) {
                        if (s == Player.STATE_ENDED) { currentId = null; _state.value = Playback() }
                    }
                })
            }
        }
        return player!!
    }

    /** Toggle: if [id] is already the active clip, stop; else play [uriOrNull]. */
    fun toggleUrl(id: String, uri: String?) = main.post {
        if (currentId == id && player?.isPlaying == true) { stopInternal(); return@post }
        if (uri == null) return@post
        playItem(id, MediaItem.fromUri(uri))
    }

    fun toggleBytes(id: String, base64: String, mime: String) = main.post {
        if (currentId == id && player?.isPlaying == true) { stopInternal(); return@post }
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        val ext = if (mime.contains("ogg")) "ogg" else if (mime.contains("mp")) "mp3" else "wav"
        val f = File(context.cacheDir, "tts_${id.hashCode()}.$ext").apply { writeBytes(bytes) }
        playItem(id, MediaItem.fromUri(android.net.Uri.fromFile(f)))
    }

    private fun playItem(id: String, item: MediaItem) {
        val p = ensurePlayer()
        currentId = id
        p.setMediaItem(item); p.prepare(); p.setPlaybackSpeed(speed); p.playWhenReady = true
        _state.value = Playback(id, true, 0, 0, speed)
    }

    private fun stopInternal() { player?.stop(); currentId = null; _state.value = Playback() }
    fun stop() = main.post { stopInternal() }
    fun release() = main.post { player?.release(); player = null; currentId = null; _state.value = Playback() }
}
