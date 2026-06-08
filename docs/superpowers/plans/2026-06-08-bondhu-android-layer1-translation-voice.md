# Bondhu Android — Layer 1 (Translation & Voice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Each task builds + commits.

**Goal:** Add Bondhu's core features to the Android app: voice playback + transcript/translation, TTS speaker, outgoing translate, outgoing voice, mic→transcribe, per-chat/global language, and profile photos — at parity with the web client.

**Architecture:** Same MVVM. New: `AudioPlayer` (Media3 ExoPlayer singleton) + `VoiceRecorder` (MediaRecorder) + `MediaUrlBuilder` + `LanguageRepository`; extend `BondhuApi`/`ChatRepository`/`ChatViewModel`/`MessageBubble`/`Composer`. Token-in-URL media/profile-pic loaded by a plain Coil/ExoPlayer client (no host/auth interceptor).

**Tech stack add:** `androidx.media3:media3-exoplayer` + `media3-common` 1.4.1. Coil (already present). RECORD_AUDIO permission via `rememberLauncherForActivityResult`.

**Spec:** `docs/superpowers/specs/2026-06-08-bondhu-android-layer1-translation-voice.md`.
**Reference:** web client `web/src/components/chat/{MessageBubble,Composer,ChatView}.tsx`, `web/src/lib/api.ts` — implementers should consult these for exact UX.

---

## Conventions (every task)
- Paths under `E:\New Whatsapp\android\`. Build with the bundled JBR:
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; .\gradlew.bat <tasks>` (PowerShell, long timeout up to 600000 ms).
- Build gate per task: `:app:assembleDebug` = BUILD SUCCESSFUL. TDD (JUnit + MockWebServer) for data-layer logic; UI/audio are build-gated + device-verified in Task 13.
- Commit per task; messages end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Branch `feat/android-layer1-translation-voice` (already checked out).
- Existing models: `Message{id,chatJid,fromMe,type,body,timestamp,ack:AckTick,translated,transcript,senderName}`; `Prefs` (jwt/activeAccount/baseUrl + *Blocking()); `BondhuApi` (login under /api/auth/*, others /api/*); `SocketManager`; `ChatRepository{chats,messages,send,markRead}`; `ChatViewModel`; `MessageBubble`, `Composer`, `ChatScreen`, chatlist `ChatRow`. NetworkModule provides Moshi/OkHttp/Retrofit/BondhuApi.

---

## Task 1: media3 catalog + DTOs + BondhuApi endpoints + MediaUrlBuilder (TDD)

**Files:** add to `gradle/libs.versions.toml`, `app/build.gradle.kts`; create `data/model/AiDtos.kt`, `data/api/MediaUrlBuilder.kt`; modify `data/api/BondhuApi.kt`; test `app/src/test/java/com/bondhu/app/MediaUrlBuilderTest.kt`.

- [ ] **Step 1: Catalog — add media3** to `gradle/libs.versions.toml` under `[versions]` and `[libraries]`:
```toml
# [versions]
media3 = "1.4.1"
# [libraries]
media3-exoplayer = { module = "androidx.media3:media3-exoplayer", version.ref = "media3" }
media3-common = { module = "androidx.media3:media3-common", version.ref = "media3" }
```

- [ ] **Step 2: app deps** — add to `app/build.gradle.kts` dependencies:
```kotlin
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.common)
```

- [ ] **Step 3: Write failing test** `MediaUrlBuilderTest.kt`:
```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.MediaUrlBuilder
import org.junit.Assert.assertEquals
import org.junit.Test

class MediaUrlBuilderTest {
    private val b = MediaUrlBuilder(
        baseUrlProvider = { "https://wa.client-flow.xyz" },
        tokenProvider = { "JWT123" },
        accountProvider = { "account-7" },
    )
    @Test fun media_buildsTokenisedUrl() {
        assertEquals(
            "https://wa.client-flow.xyz/api/media/ABC?account=account-7&token=JWT123",
            b.media("ABC"),
        )
    }
    @Test fun profilePic_encodesJid() {
        assertEquals(
            "https://wa.client-flow.xyz/api/profile-pic?account=account-7&id=12%40lid&token=JWT123",
            b.profilePic("12@lid"),
        )
    }
    @Test fun returnsNull_whenNoAccountOrToken() {
        val nb = MediaUrlBuilder({ "https://x" }, { null }, { "a" })
        assertEquals(null, nb.media("X"))
    }
}
```

- [ ] **Step 4: Run test → FAIL**: `.\gradlew.bat :app:testDebugUnitTest --tests "com.bondhu.app.MediaUrlBuilderTest"`

- [ ] **Step 5: `data/api/MediaUrlBuilder.kt`** — uses `java.net.URLEncoder` (NOT `android.net.Uri`) so the unit test runs on the plain JVM. `@` encodes to `%40`, which matches the test:
```kotlin
package com.bondhu.app.data.api

import com.bondhu.app.data.store.Prefs
import javax.inject.Inject
import javax.inject.Singleton

/** Builds absolute, token-authenticated URLs for /media and /profile-pic, which
 *  authenticate via a `?token=<jwt>` query param (not a header). Returns null if
 *  the user/account isn't ready. */
@Singleton
class MediaUrlBuilder(
    private val baseUrlProvider: () -> String,
    private val tokenProvider: () -> String?,
    private val accountProvider: () -> String?,
) {
    @Inject constructor(prefs: Prefs) : this(
        baseUrlProvider = { prefs.baseUrlBlocking().trimEnd('/') },
        tokenProvider = { prefs.jwtBlocking() },
        accountProvider = { prefs.activeAccountBlocking() },
    )

    private fun enc(s: String): String = java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    fun media(msgId: String): String? {
        val token = tokenProvider() ?: return null
        val account = accountProvider() ?: return null
        return "${baseUrlProvider()}/api/media/${enc(msgId)}?account=${enc(account)}&token=${enc(token)}"
    }

    fun profilePic(jid: String): String? {
        val token = tokenProvider() ?: return null
        val account = accountProvider() ?: return null
        return "${baseUrlProvider()}/api/profile-pic?account=${enc(account)}&id=${enc(jid)}&token=${enc(token)}"
    }
}
```

- [ ] **Step 6: Extend `data/model/AiDtos.kt`** (new file):
```kotlin
package com.bondhu.app.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true) data class TtsRequest(val account: String, val msgId: String, val text: String, val lang: String? = null)
@JsonClass(generateAdapter = true) data class TtsResponse(val audioBase64: String, val mime: String)

@JsonClass(generateAdapter = true) data class TranscribeRequest(val account: String, val audioBase64: String, val mimeType: String)
@JsonClass(generateAdapter = true) data class TranscribeResponse(val transcript: String?)

@JsonClass(generateAdapter = true) data class RetranscribeRequest(val account: String, val msgId: String)

@JsonClass(generateAdapter = true) data class RetranslateRequest(val account: String, val msgId: String, val text: String, val chatId: String)
@JsonClass(generateAdapter = true) data class RetranslateResponse(val translated: String?, val lang: String?)

@JsonClass(generateAdapter = true) data class SendVoiceRequest(val account: String, val chatId: String, val message: String, val translateTo: String? = null)
@JsonClass(generateAdapter = true) data class SendVoiceResponse(
    val success: Boolean = true,
    val voiceMsgId: String? = null,
    val textMsgId: String? = null,
    val sentText: String? = null,
    val original: String? = null,
    val audioBase64: String? = null,
    val mime: String? = null,
)

@JsonClass(generateAdapter = true) data class LangOption(val code: String, val name: String, val flag: String)
@JsonClass(generateAdapter = true) data class LanguageResponse(val lang: String, val supported: List<LangOption>)
@JsonClass(generateAdapter = true) data class SetLanguageRequest(val lang: String)
@JsonClass(generateAdapter = true) data class ChatLanguageResponse(val lang: String? = null)
@JsonClass(generateAdapter = true) data class SetChatLanguageRequest(val lang: String?)
@JsonClass(generateAdapter = true) data class ProfileResponse(val jid: String, val about: String? = null, val phoneJid: String? = null, val phone: String? = null)
```

- [ ] **Step 7: Extend `BondhuApi.kt`** — add (note ai/whatsapp routes are under `/api`):
```kotlin
    @POST("api/tts")
    suspend fun tts(@Body body: TtsRequest): TtsResponse

    @POST("api/transcribe")
    suspend fun transcribe(@Body body: TranscribeRequest): TranscribeResponse

    @POST("api/retranscribe")
    suspend fun retranscribe(@Body body: RetranscribeRequest): TranscribeResponse

    @POST("api/retranslate")
    suspend fun retranslate(@Body body: RetranslateRequest): RetranslateResponse

    @POST("api/send-voice")
    suspend fun sendVoice(@Body body: SendVoiceRequest): SendVoiceResponse

    @GET("api/settings/language")
    suspend fun getLanguage(): LanguageResponse

    @POST("api/settings/language")
    suspend fun setLanguage(@Body body: SetLanguageRequest): OkResponse

    @GET("api/chats/{chatId}/language")
    suspend fun getChatLanguage(@Path("chatId") chatId: String, @Query("account") account: String): ChatLanguageResponse

    @POST("api/chats/{chatId}/language")
    suspend fun setChatLanguage(@Path("chatId") chatId: String, @Query("account") account: String, @Body body: SetChatLanguageRequest): OkResponse

    @GET("api/profile")
    suspend fun profile(@Query("account") account: String, @Query("id") id: String): ProfileResponse
```
(`tts/transcribe/retranscribe/retranslate/sendVoice` carry `account` in the body since the ai-routes `account()` helper reads query OR body; passing it in the typed body keeps one source. `getLanguage`/`setLanguage` are user-global, no account.)

- [ ] **Step 8: Run test → PASS**, then `:app:assembleDebug` → SUCCESS.
- [ ] **Step 9: Commit** `feat(android): media3 dep, AI/voice DTOs, BondhuApi endpoints, MediaUrlBuilder (tested)`.

---

## Task 2: ChatRepository + LanguageRepository methods (TDD)

**Files:** modify `data/repository/ChatRepository.kt`; create `data/repository/LanguageRepository.kt`; test `app/src/test/java/com/bondhu/app/Layer1RepoTest.kt`.

- [ ] **Step 1: Write failing test** `Layer1RepoTest.kt`:
```kotlin
package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.repository.LanguageRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class Layer1RepoTest {
    private fun api(s: MockWebServer) = Retrofit.Builder().baseUrl(s.url("/")).client(OkHttpClient())
        .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build())).build().create(BondhuApi::class.java)

    @Test fun tts_returnsAudio() = runTest {
        val s = MockWebServer().apply { enqueue(MockResponse().setBody("""{"audioBase64":"AAA","mime":"audio/wav"}""")); start() }
        val r = ChatRepository(api(s))
        val res = r.tts("acc","m1","hi","en")
        assertEquals("AAA", res.audioBase64); assertEquals("audio/wav", res.mime)
        assertEquals("/api/tts", s.takeRequest().path); s.shutdown()
    }
    @Test fun sendVoice_returnsIds() = runTest {
        val s = MockWebServer().apply { enqueue(MockResponse().setBody("""{"success":true,"voiceMsgId":"v1","textMsgId":"t1","sentText":"salut","audioBase64":"AA","mime":"audio/wav"}""")); start() }
        val res = ChatRepository(api(s)).sendVoice("acc","c@lid","hi","fr")
        assertEquals("v1", res.voiceMsgId); assertEquals("t1", res.textMsgId); assertEquals("salut", res.sentText); s.shutdown()
    }
    @Test fun language_listAndPerChat() = runTest {
        val s = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"lang":"bn","supported":[{"code":"bn","name":"Bengali","flag":"BD"},{"code":"en","name":"English","flag":"US"}]}"""))
            enqueue(MockResponse().setBody("""{"lang":"fr"}"""))
            start()
        }
        val lr = LanguageRepository(api(s))
        val g = lr.getGlobal(); assertEquals("bn", g.lang); assertEquals(2, g.supported.size)
        assertEquals("fr", lr.getChat("acc","c@lid")); s.shutdown()
    }
}
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Extend `ChatRepository.kt`** (keep existing chats/messages/send/markRead; add):
```kotlin
    suspend fun tts(account: String, msgId: String, text: String, lang: String?) =
        api.tts(com.bondhu.app.data.model.TtsRequest(account, msgId, text, lang))
    suspend fun transcribe(account: String, audioBase64: String, mimeType: String) =
        api.transcribe(com.bondhu.app.data.model.TranscribeRequest(account, audioBase64, mimeType)).transcript
    suspend fun retranscribe(account: String, msgId: String) =
        api.retranscribe(com.bondhu.app.data.model.RetranscribeRequest(account, msgId)).transcript
    suspend fun retranslate(account: String, chatId: String, msgId: String, text: String) =
        api.retranslate(com.bondhu.app.data.model.RetranslateRequest(account, msgId, text, chatId))
    suspend fun sendVoice(account: String, chatId: String, message: String, translateTo: String?) =
        api.sendVoice(com.bondhu.app.data.model.SendVoiceRequest(account, chatId, message, translateTo))
    suspend fun profile(account: String, id: String) = api.profile(account, id)
```

- [ ] **Step 4: `data/repository/LanguageRepository.kt`**:
```kotlin
package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.LanguageResponse
import com.bondhu.app.data.model.SetChatLanguageRequest
import com.bondhu.app.data.model.SetLanguageRequest
import javax.inject.Inject

class LanguageRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun getGlobal(): LanguageResponse = api.getLanguage()
    suspend fun setGlobal(lang: String) { api.setLanguage(SetLanguageRequest(lang)) }
    suspend fun getChat(account: String, chatId: String): String? = api.getChatLanguage(chatId, account).lang
    suspend fun setChat(account: String, chatId: String, lang: String?) { api.setChatLanguage(chatId, account, SetChatLanguageRequest(lang)) }
}
```

- [ ] **Step 5: Run test → PASS**, `:app:assembleDebug` → SUCCESS.
- [ ] **Step 6: Commit** `feat(android): ChatRepository voice/tts + LanguageRepository (tested)`.

---

## Task 3: Prefs per-chat outLang + sendMode

**Files:** modify `data/store/Prefs.kt`.

- [ ] **Step 1:** Add to `Prefs` (use dynamic keys per jid):
```kotlin
    // per-chat composer prefs
    fun outLangKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("out_lang_${jid}")
    fun sendModeKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("send_mode_${jid}")

    suspend fun setOutLang(jid: String, lang: String?) = ds.edit { p -> val k = outLangKey(jid); if (lang == null) p.remove(k) else p[k] = lang }
    fun outLangBlocking(jid: String): String? = runBlocking { ds.data.first()[outLangKey(jid)] }
    suspend fun setSendMode(jid: String, mode: String) = ds.edit { it[sendModeKey(jid)] = mode } // "text" | "voice"
    fun sendModeBlocking(jid: String): String = runBlocking { ds.data.first()[sendModeKey(jid)] ?: "text" }
```
Add the import `import kotlinx.coroutines.flow.first` if missing (it is already imported).

- [ ] **Step 2:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): per-chat outLang + sendMode in Prefs`.

---

## Task 4: AudioPlayer (Media3 ExoPlayer singleton)

**Files:** create `data/audio/AudioPlayer.kt`.

**Design:** one shared ExoPlayer on the main looper; play a URL (`/media`) or
decoded base64 bytes (TTS/own-voice) written to a cache file. Expose
`StateFlow<Playback>` with `(id, isPlaying, positionMs, durationMs)`. All player
calls marshalled to the main thread.

- [ ] **Step 1: `data/audio/AudioPlayer.kt`**:
```kotlin
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

data class Playback(val id: String? = null, val isPlaying: Boolean = false, val positionMs: Long = 0, val durationMs: Long = 0)

@Singleton
class AudioPlayer @Inject constructor(@ApplicationContext private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private val _state = MutableStateFlow(Playback())
    val state: StateFlow<Playback> = _state
    private var player: ExoPlayer? = null
    private var currentId: String? = null
    private val ticker = object : Runnable {
        override fun run() {
            val p = player ?: return
            _state.value = Playback(currentId, p.isPlaying, p.currentPosition.coerceAtLeast(0), p.duration.coerceAtLeast(0))
            if (p.isPlaying) main.postDelayed(this, 250)
        }
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
        p.setMediaItem(item); p.prepare(); p.playWhenReady = true
        _state.value = Playback(id, true, 0, 0)
    }

    private fun stopInternal() { player?.stop(); currentId = null; _state.value = Playback() }
    fun stop() = main.post { stopInternal() }
    fun release() = main.post { player?.release(); player = null; currentId = null; _state.value = Playback() }
}
```
(`@androidx.media3.common.util.UnstableApi` may be required on some calls; if the compiler demands it, annotate the class with `@OptIn(androidx.media3.common.util.UnstableApi::class)` or add the file-level opt-in. Resolve per the build error.)

- [ ] **Step 2:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): AudioPlayer (Media3) singleton with playback state`.

---

## Task 5: VoiceRecorder + RECORD_AUDIO permission

**Files:** create `data/audio/VoiceRecorder.kt`; modify `AndroidManifest.xml`.

- [ ] **Step 1: Manifest** — add under `<manifest>`:
```xml
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
```

- [ ] **Step 2: `data/audio/VoiceRecorder.kt`**:
```kotlin
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
```

- [ ] **Step 3:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): VoiceRecorder (AAC/m4a) + RECORD_AUDIO permission`.

---

## Task 6: Speaker (TTS) + TranslationText, wire into text MessageBubble

**Files:** create `ui/chat/Speaker.kt`, `ui/chat/TranslationText.kt`; modify `ui/chat/MessageBubble.kt` and `ui/chat/ChatViewModel.kt`.

Implementer: consult `web/src/components/chat/MessageBubble.tsx` (Speaker, translation sub-text). The ViewModel exposes a `tts(msgId, text, lang)` action and the player state.

- [ ] **Step 1: `ui/chat/TranslationText.kt`** — "Translated" label + text + Speaker:
```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun TranslationText(text: String, onSpeak: (() -> Unit)?, speaking: Boolean, modifier: Modifier = Modifier) {
    Column(modifier.padding(top = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Translated", color = Tokens.Primary, fontSize = 10.sp)
            if (onSpeak != null) { Spacer(Modifier.width(6.dp)); Speaker(onSpeak, speaking) }
        }
        Text(text, color = Tokens.TextMut, fontSize = 13.sp)
    }
}
```

- [ ] **Step 2: `ui/chat/Speaker.kt`**:
```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun Speaker(onClick: () -> Unit, speaking: Boolean) {
    IconButton(onClick = onClick, modifier = Modifier.size(22.dp)) {
        Icon(Icons.AutoMirrored.Filled.VolumeUp, "Play translation",
            tint = if (speaking) Tokens.Primary else Tokens.TextMut, modifier = Modifier.size(16.dp))
    }
}
```

- [ ] **Step 3: ChatViewModel** — add player state + tts action:
```kotlin
    // inject AudioPlayer in the constructor: private val audio: AudioPlayer
    val playback get() = audio.state
    fun speak(msg: Message) {
        val text = msg.translated ?: msg.body ?: return
        viewModelScope.launch {
            try { val r = repo.tts(account, msg.id, text, null); audio.toggleBytes("tts-${msg.id}", r.audioBase64, r.mime) }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
```
Add `AudioPlayer` to the `@Inject` constructor params. Import `com.bondhu.app.data.audio.AudioPlayer`.

- [ ] **Step 4: MessageBubble** — accept callbacks + render TranslationText for text messages. Change signature to `MessageBubble(m: Message, speaking: Boolean, onSpeak: () -> Unit)` and, after the body Text for non-voice types, render:
```kotlin
            if (m.translated != null && m.type == "text") {
                TranslationText(m.translated, onSpeak = onSpeak, speaking = speaking)
            }
            if (m.fromMe && m.body != null && m.translated == null) { /* original sublabel handled in send path */ }
```
In `ChatScreen`'s `items(...)`, pass `speaking = (playback.id == "tts-${it.id}" && playback.isPlaying)` and `onSpeak = { vm.speak(it) }` (collect `vm.playback` via `collectAsStateWithLifecycle`).

- [ ] **Step 5:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): TTS Speaker + translation sub-text on text bubbles`.

---

## Task 7: VoiceBubble (player + transcript/translation) for voice messages

**Files:** create `ui/chat/VoiceBubble.kt`; modify `ui/chat/MessageBubble.kt`, `ui/chat/ChatViewModel.kt`.

Reference: `web/src/components/chat/MessageBubble.tsx:141-172`.

- [ ] **Step 1: ChatViewModel** — voice actions + media url:
```kotlin
    // inject MediaUrlBuilder: private val media: MediaUrlBuilder
    fun playVoice(msg: Message, localBase64: String? = null, mime: String? = null) {
        if (localBase64 != null && mime != null) { audio.toggleBytes("voice-${msg.id}", localBase64, mime); return }
        audio.toggleUrl("voice-${msg.id}", media.media(msg.id))
    }
    fun retranscribe(msg: Message) {
        viewModelScope.launch {
            try {
                val t = repo.retranscribe(account, msg.id) ?: return@launch
                upsertPatch(msg.id) { it.copy(transcript = t) }
                val tr = repo.retranslate(account, chatId, msg.id, t)
                if (tr.translated != null) upsertPatch(msg.id) { it.copy(translated = tr.translated) }
            } catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
    private fun upsertPatch(id: String, f: (Message) -> Message) {
        _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) f(it) else it })
    }
```
Inject `MediaUrlBuilder media`.

- [ ] **Step 2: `ui/chat/VoiceBubble.kt`**:
```kotlin
package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens

@Composable
fun VoiceBubble(
    m: Message, isPlaying: Boolean, progress: Float,
    onPlayToggle: () -> Unit, onSpeak: () -> Unit, speaking: Boolean, onRetranscribe: () -> Unit,
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onPlayToggle) {
                Icon(if (isPlaying) Icons.Default.Stop else Icons.Default.PlayArrow, "Play voice", tint = Tokens.TextMain)
            }
            LinearProgressIndicator(progress = { progress.coerceIn(0f, 1f) }, modifier = Modifier.weight(1f).height(3.dp), color = Tokens.Primary, trackColor = Tokens.Divider)
            Spacer(Modifier.width(8.dp))
        }
        if (!m.fromMe) {
            if (m.transcript != null) {
                Text("Transcript", color = Tokens.TextMut, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
                Text(m.transcript, color = Tokens.TextMain, fontSize = 13.sp)
                if (m.translated != null) TranslationText(m.translated, onSpeak = onSpeak, speaking = speaking)
            } else {
                TextButton(onClick = onRetranscribe) { Text("Transcribe", color = Tokens.Primary) }
            }
        }
    }
}
```

- [ ] **Step 3: MessageBubble** — for `m.type == "ptt" || m.type == "audio"`, render `VoiceBubble(...)` instead of the body Text. Wire from ChatScreen: compute `isPlaying`/`progress` from `vm.playback` (`playback.id == "voice-${m.id}"`, progress = `positionMs.toFloat()/durationMs` guarded), `onPlayToggle = { vm.playVoice(m) }`, `onRetranscribe = { vm.retranscribe(m) }`.

- [ ] **Step 4:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): VoiceBubble — playback + transcript/translation + retranscribe`.

---

## Task 8: Profile photos (Coil) in ChatRow + chat header

**Files:** create `ui/common/RemoteAvatar.kt`; modify `ui/chatlist/ChatListScreen.kt`, `ui/chat/ChatScreen.kt`; inject `MediaUrlBuilder` into `ChatListViewModel` (or build URL in a small helper exposed to UI).

- [ ] **Step 1: `ui/common/RemoteAvatar.kt`** — Coil avatar with initials fallback:
```kotlin
package com.bondhu.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.bondhu.app.ui.theme.Tokens

@Composable
fun RemoteAvatar(name: String?, url: String?, size: Int = 46, modifier: Modifier = Modifier) {
    Box(modifier.size(size.dp).clip(CircleShape).background(avColor(name)), contentAlignment = Alignment.Center) {
        Text(initials(name), color = Tokens.AppBg, fontWeight = FontWeight.SemiBold, fontSize = (size * 0.4).sp)
        if (url != null) {
            SubcomposeAsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop,
                modifier = Modifier.size(size.dp).clip(CircleShape), loading = {}, error = {})
        }
    }
}
```
(Coil loads the absolute tokenised URL directly. The default Coil ImageLoader uses its own OkHttp client — it does NOT go through `HostSelectionInterceptor`/`AuthInterceptor`, which is exactly what we want since the URL is already absolute + tokenised.)

- [ ] **Step 2: ChatListViewModel** — expose `fun avatarUrl(jid: String): String?` via injected `MediaUrlBuilder` (add to constructor). `ChatRowItem` uses `RemoteAvatar(row.title, vm.avatarUrl(row.jid))`.

- [ ] **Step 3: ChatScreen header** — replace title-only top bar with `RemoteAvatar` + name (build url via the same builder injected into `ChatViewModel`, expose `fun headerAvatarUrl(): String?`).

- [ ] **Step 4:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): Coil profile photos in chat list + header`.

---

## Task 9: Composer upgrade — mode toggle + language picker + dynamic placeholder

**Files:** modify `ui/chat/Composer.kt`, `ui/chat/ChatViewModel.kt`; create `ui/chat/LanguageSheet.kt`.

Reference: `web/src/components/chat/Composer.tsx`.

- [ ] **Step 1: ChatViewModel** — expose composer state:
```kotlin
    // state additions in ChatUiState: sendMode:String="text", outLang:String?=null, supported:List<LangOption> = emptyList()
    fun loadComposerPrefs() {
        sendMode = prefs.sendModeBlocking(chatId); outLang = prefs.outLangBlocking(chatId)
        _state.value = _state.value.copy(sendMode = sendMode, outLang = outLang)
        viewModelScope.launch { try { _state.value = _state.value.copy(supported = lang.getGlobal().supported) } catch (_: Exception) {} }
    }
    fun setSendMode(m: String) { viewModelScope.launch { prefs.setSendMode(chatId, m) }; sendMode = m; _state.value = _state.value.copy(sendMode = m) }
    fun setOutLang(code: String?) { viewModelScope.launch { prefs.setOutLang(chatId, code) }; outLang = code; _state.value = _state.value.copy(outLang = code) }
```
Inject `LanguageRepository lang`. Add `private var sendMode="text"; private var outLang:String?=null`. Call `loadComposerPrefs()` in `bind`.

- [ ] **Step 2: `ui/chat/LanguageSheet.kt`** — ModalBottomSheet of LangOptions (+ "Send as typed"/"Default" null entry), searchable. (Implementer: simple `LazyColumn` of rows `flag name`, a search `TextField`, tap → callback. Keep it ~60 lines.)

- [ ] **Step 3: Composer** — add a row above the text field: mode toggle (`Aa` / `🎙️` FilterChips; voice disabled when `outLang==null`), a language chip (shows flag+code or "Aa") opening the LanguageSheet, dynamic placeholder per spec. Wire `onSend` to choose text vs voice in the ViewModel.

- [ ] **Step 4:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): composer mode toggle + language picker + sheet`.

---

## Task 10: Mic record flow (overlay + transcribe → draft)

**Files:** modify `ui/chat/Composer.kt`, `ui/chat/ChatViewModel.kt`, `MainActivity.kt` (permission) or handle permission in Composer.

- [ ] **Step 1: ChatViewModel** — recording actions:
```kotlin
    // inject VoiceRecorder recorder; state: recording:Boolean=false, recordSecs:Int=0
    fun startRecording(nowMs: Long) { try { recorder.start(nowMs); _state.value = _state.value.copy(recording = true, recordSecs = 0) } catch (e: Exception) { _state.value = _state.value.copy(error = e.message) } }
    fun tickRecording() { if (_state.value.recording) _state.value = _state.value.copy(recordSecs = _state.value.recordSecs + 1) }
    fun cancelRecording() { recorder.cancel(); _state.value = _state.value.copy(recording = false) }
    fun stopRecordingAndTranscribe() {
        val res = recorder.stop(); _state.value = _state.value.copy(recording = false)
        if (res == null) return
        viewModelScope.launch {
            try { val t = repo.transcribe(account, res.first, res.second); if (!t.isNullOrBlank()) _state.value = _state.value.copy(draft = t) }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
```
Inject `VoiceRecorder recorder`.

- [ ] **Step 2: Composer** — mic button: request `RECORD_AUDIO` via `rememberLauncherForActivityResult(RequestPermission())`; on granted start; show a record overlay (timer from `recordSecs`, cancel + stop buttons). A `LaunchedEffect(recording)` drives a 1s `tickRecording()` loop. Stop → `stopRecordingAndTranscribe()` fills the draft; user reviews then sends.

- [ ] **Step 3:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): mic record → transcribe → draft (with permission + overlay)`.

---

## Task 11: Outgoing translate + send-voice paths (ChatViewModel)

**Files:** modify `ui/chat/ChatViewModel.kt`.

- [ ] **Step 1:** Replace the existing `send()` with mode-aware logic:
```kotlin
    fun send() {
        val text = _state.value.draft.trim(); if (text.isEmpty() || account.isEmpty()) return
        val mode = _state.value.sendMode; val tLang = _state.value.outLang
        _state.value = _state.value.copy(draft = "", sending = true)
        viewModelScope.launch {
            try {
                if (mode == "voice" && tLang != null) {
                    val r = repo.sendVoice(account, chatId, text, tLang)
                    r.voiceMsgId?.let { upsert(Message(it, chatId, true, "ptt", null, now(), AckTick.SENT, null, null, null)) }
                    r.textMsgId?.let { upsert(Message(it, chatId, true, "text", r.sentText ?: text, now(), AckTick.SENT, r.original?.let { _ -> null }, null, null)) }
                    // own-voice immediate replay handled by /media fallback; optional: cache r.audioBase64
                } else {
                    val r = repo.send(account, chatId, text, tLang)
                    r.msgId?.let { upsert(Message(it, chatId, true, "text", r.sentText ?: text, now(), AckTick.SENT, null, null, null)) }
                    // r.original (what the user wrote) can be shown as a sub-label; store via a side map if desired
                }
                _state.value = _state.value.copy(sending = false)
            } catch (e: Exception) { _state.value = _state.value.copy(sending = false, error = e.message, draft = text) }
        }
    }
    private fun now() = System.currentTimeMillis() / 1000
```
(Note: for the "you wrote: {original}" sub-label on own translated text, keep a `Map<msgId, original>` in the ViewModel and have MessageBubble show it; or defer that sub-label to Layer-1 polish. Keep the dedupe pattern: optimistic bubble uses the real returned id.)

- [ ] **Step 2:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): outgoing translate + send-voice paths with optimistic bubbles`.

---

## Task 12: Per-chat LanguageSheet from chat header overflow

**Files:** modify `ui/chat/ChatScreen.kt`, `ui/chat/ChatViewModel.kt`.

- [ ] **Step 1: ChatViewModel** — per-chat language:
```kotlin
    // state: chatLang:String?=null, langSheetOpen:Boolean=false
    fun openLangSheet() { _state.value = _state.value.copy(langSheetOpen = true) }
    fun closeLangSheet() { _state.value = _state.value.copy(langSheetOpen = false) }
    fun setChatLanguage(code: String?) {
        viewModelScope.launch {
            try { lang.setChat(account, chatId, code); _state.value = _state.value.copy(chatLang = code, langSheetOpen = false); load() }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
    // in bind(): viewModelScope.launch { try { _state.value = _state.value.copy(chatLang = lang.getChat(account, chatId)) } catch (_:Exception){} }
```

- [ ] **Step 2: ChatScreen** — top-bar overflow (⋮) menu → "Chat language" opens `LanguageSheet` (current = `chatLang`, includes a "Default" null option) → `vm.setChatLanguage(code)`.

- [ ] **Step 3:** `:app:assembleDebug` → SUCCESS. **Commit** `feat(android): per-chat language picker from chat header`.

---

## Task 13: Integration, build, device acceptance

**Files:** none required (verify); update `android/README.md` Layer-1 scope; release `AudioPlayer` on activity stop if needed.

- [ ] **Step 1:** Ensure `AudioPlayer.release()`/`stop()` is called when leaving a chat (e.g., `DisposableEffect` in `ChatScreen` → `vm` stops playback `onDispose`). Add if missing.
- [ ] **Step 2:** Full unit suite green: `.\gradlew.bat :app:testDebugUnitTest` (MediaUrlBuilderTest, Layer1RepoTest + all v1 tests).
- [ ] **Step 3:** `:app:assembleDebug` green; build the APK.
- [ ] **Step 4: Device acceptance (live server):** received voice plays + shows transcript/translation; Speaker reads a message via TTS; pick a language → send text (recipient gets translated, bubble shows sentText); switch 🎙️ → send voice (recipient gets a voice note; own replay works); hold mic, speak Bangla, release → transcript fills → send translated; avatars load in list + header.
- [ ] **Step 5:** Update `android/README.md` (Layer-1 features), commit, then superpowers:finishing-a-development-branch → merge to master + push.

---

## Self-review (coverage)
- Spec §1 features → Tasks 6/7 (TTS+translation, voice), 9/10/11 (composer/mic/outgoing), 8 (avatars), 12 (per-chat lang). ✅
- Spec §2 contracts → Task 1 (DTOs/api/urls), 2 (repos). ✅
- Spec §3 audio → Tasks 4 (player), 5 (recorder). ✅
- Spec §4 gotchas (mic format, token-url, own-voice, dedupe) → noted in Tasks 1/4/5/8/11. ✅
- Device verification → Task 13. ✅

**Known device-verify items:** `/transcribe` accepting m4a (fallback OGG/Opus API29+); Media3 `@UnstableApi` opt-in; own-voice immediate replay (currently via `/media` fallback — optionally cache `audioBase64`).
