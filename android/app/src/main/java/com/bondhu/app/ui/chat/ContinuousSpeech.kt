package com.bondhu.app.ui.chat

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext

/**
 * Continuous on-device dictation built on [SpeechRecognizer] — the same engine
 * as Gboard voice typing — NOT the one-shot `RecognizerIntent` popup, which
 * closes itself the moment you pause. This restarts the recognizer after every
 * segment so it keeps listening across pauses and stops ONLY when the user taps
 * stop(). Finalised segments accumulate; stop() emits the whole text.
 *
 * A short silence (no-match / timeout) just means a quiet stretch, so we keep
 * going; only hard failures (permission, client death) end the session.
 */
class SpeechController(
    private val appContext: Context,
    private val onLive: (String) -> Unit,
    private val onFinal: (String) -> Unit,
    private val onListening: (Boolean) -> Unit,
    private val onUnavailable: () -> Unit,
    private val onRms: (Float) -> Unit = {},
) : RecognitionListener {
    private var recognizer: SpeechRecognizer? = null
    private val main = Handler(Looper.getMainLooper())
    private val buffer = StringBuilder()
    private var partial = ""
    private var listening = false
    private var restarting = false
    private var language = "bn-IN"

    val isListening get() = listening

    fun setLanguage(lang: String) { language = lang }

    fun start() {
        if (listening) return
        if (!SpeechRecognizer.isRecognitionAvailable(appContext)) { onUnavailable(); return }
        buffer.setLength(0); partial = ""
        listening = true
        onListening(true); onLive(""); onRms(0f)
        ensure(); listen()
    }

    fun stop() {
        if (!listening) return
        listening = false
        main.removeCallbacksAndMessages(null)
        if (partial.isNotBlank()) appendSegment(partial)
        partial = ""
        try { recognizer?.cancel() } catch (_: Exception) {}
        onListening(false); onLive(""); onRms(0f)
        onFinal(buffer.toString().trim())
        buffer.setLength(0)
    }

    /** Stop WITHOUT committing — discards whatever was dictated. */
    fun cancel() {
        if (!listening) return
        listening = false
        main.removeCallbacksAndMessages(null)
        partial = ""; buffer.setLength(0)
        try { recognizer?.cancel() } catch (_: Exception) {}
        onListening(false); onLive(""); onRms(0f)
    }

    fun destroy() {
        listening = false
        main.removeCallbacksAndMessages(null)
        try { recognizer?.destroy() } catch (_: Exception) {}
        recognizer = null
    }

    private fun ensure() {
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(appContext).also { it.setRecognitionListener(this) }
        }
    }

    private fun listen() {
        ensure()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            // Snappier: finalise a segment after ~1s of silence (was 2.5s) so the
            // text settles and the next phrase starts being recognised quickly.
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 900L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 800L)
        }
        try { recognizer?.startListening(intent) } catch (_: Exception) { scheduleRestart() }
    }

    private fun scheduleRestart() {
        if (!listening || restarting) return
        restarting = true
        // Short gap — small enough to feel continuous, large enough to dodge
        // ERROR_RECOGNIZER_BUSY when restarting back-to-back.
        main.postDelayed({
            restarting = false
            if (listening) { try { recognizer?.cancel() } catch (_: Exception) {}; listen() }
        }, 120)
    }

    private fun appendSegment(s: String) {
        val t = s.trim()
        if (t.isEmpty()) return
        if (buffer.isNotEmpty()) buffer.append(' ')
        buffer.append(t)
    }

    private fun emitLive() {
        onLive((buffer.toString() + " " + partial).trim())
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) { if (listening) onRms(rmsdB) }
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}

    override fun onPartialResults(results: Bundle?) {
        val txt = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
        if (!txt.isNullOrBlank()) { partial = txt; emitLive() }
    }

    override fun onResults(results: Bundle?) {
        val txt = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
        if (!txt.isNullOrBlank()) appendSegment(txt)
        partial = ""
        emitLive()
        if (listening) scheduleRestart()
    }

    override fun onError(error: Int) {
        when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS,
            SpeechRecognizer.ERROR_CLIENT -> stop()
            else -> if (listening) scheduleRestart() // silence / no-match / busy → keep going
        }
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
}

@Composable
fun rememberSpeechController(
    language: String,
    onLive: (String) -> Unit,
    onFinal: (String) -> Unit,
    onListening: (Boolean) -> Unit,
    onUnavailable: () -> Unit,
    onRms: (Float) -> Unit = {},
): SpeechController {
    val ctx = LocalContext.current.applicationContext
    // Wrap callbacks so the controller (created once) always invokes the LATEST
    // lambda — onFinal reads the current draft, etc.
    val liveS = rememberUpdatedState(onLive)
    val finalS = rememberUpdatedState(onFinal)
    val listeningS = rememberUpdatedState(onListening)
    val unavailS = rememberUpdatedState(onUnavailable)
    val rmsS = rememberUpdatedState(onRms)
    val controller = remember {
        SpeechController(
            ctx,
            onLive = { liveS.value(it) },
            onFinal = { finalS.value(it) },
            onListening = { listeningS.value(it) },
            onUnavailable = { unavailS.value() },
            onRms = { rmsS.value(it) },
        )
    }
    LaunchedEffect(language) { controller.setLanguage(language) }
    DisposableEffect(Unit) { onDispose { controller.destroy() } }
    return controller
}
