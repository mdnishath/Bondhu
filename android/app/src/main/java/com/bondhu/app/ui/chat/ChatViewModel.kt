package com.bondhu.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.api.MediaUrlBuilder
import com.bondhu.app.data.audio.AudioPlayer
import com.bondhu.app.data.audio.VoiceRecorder
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.ackTick
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.repository.LanguageRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatUiState(
    val loading: Boolean = true,
    val messages: List<Message> = emptyList(),
    val draft: String = "",
    val sending: Boolean = false,
    val error: String? = null,
    val sendMode: String = "text",
    val outLang: String? = null,
    val supported: List<LangOption> = emptyList(),
    val recording: Boolean = false,
    val recordSecs: Int = 0,
    val chatLang: String? = null,
    val langSheetOpen: Boolean = false,
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
    private val audio: AudioPlayer,
    private val media: MediaUrlBuilder,
    private val lang: LanguageRepository,
    private val recorder: VoiceRecorder,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state
    private var account: String = ""
    private var chatId: String = ""

    fun bind(chatId: String) {
        this.chatId = chatId
        viewModelScope.launch {
            account = prefs.activeAccount.first() ?: return@launch
            load()
            loadComposerPrefs()
            runCatching { repo.markRead(account, chatId) }
            viewModelScope.launch {
                try { _state.value = _state.value.copy(chatLang = lang.getChat(account, chatId)) } catch (_: Exception) {}
            }
        }
        viewModelScope.launch { socket.events.collect { onEvent(it.name, it.payload) } }
        viewModelScope.launch { socket.connects.collect { load() } }
    }

    private fun loadComposerPrefs() {
        viewModelScope.launch {
            val mode = prefs.sendModeBlocking(chatId)
            val outLang = prefs.outLangBlocking(chatId)
            _state.value = _state.value.copy(sendMode = mode, outLang = outLang)
            runCatching {
                val resp = lang.getGlobal()
                _state.value = _state.value.copy(supported = resp.supported)
            }
        }
    }

    fun setSendMode(mode: String) {
        viewModelScope.launch {
            prefs.setSendMode(chatId, mode)
            _state.value = _state.value.copy(sendMode = mode)
        }
    }

    fun setOutLang(code: String?) {
        viewModelScope.launch {
            prefs.setOutLang(chatId, code)
            _state.value = _state.value.copy(outLang = code)
        }
    }

    fun openLangSheet() { _state.value = _state.value.copy(langSheetOpen = true) }
    fun closeLangSheet() { _state.value = _state.value.copy(langSheetOpen = false) }
    fun setChatLanguage(code: String?) {
        viewModelScope.launch {
            try {
                lang.setChat(account, chatId, code)
                _state.value = _state.value.copy(chatLang = code, langSheetOpen = false)
                load()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun onEvent(name: String, payload: org.json.JSONObject) {
        when (name) {
            "message" -> {
                if (payload.optString("chatJid") != chatId) return
                val m = Message(
                    id = payload.optString("msgId"),
                    chatJid = chatId,
                    fromMe = payload.optBoolean("fromMe"),
                    type = payload.optString("type", "text"),
                    body = payload.optString("body").ifEmpty { null },
                    timestamp = payload.optLong("timestamp"),
                    ack = ackTick(if (payload.has("ack")) payload.optInt("ack") else 0),
                    translated = payload.optString("translated").ifEmpty { null },
                    transcript = payload.optString("transcript").ifEmpty { null },
                    senderName = payload.optString("senderName").ifEmpty { null },
                )
                upsert(m)
                viewModelScope.launch { runCatching { repo.markRead(account, chatId) } }
            }
            "message_ack" -> {
                val id = payload.optString("msgId"); val ack = ackTick(payload.optInt("ack"))
                _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) it.copy(ack = ack) else it })
            }
        }
    }

    private fun upsert(m: Message) {
        val cur = _state.value.messages
        val idx = cur.indexOfFirst { it.id == m.id }
        val next = if (idx >= 0) cur.toMutableList().also { it[idx] = m } else (cur + m)
        _state.value = _state.value.copy(messages = next.sortedBy { it.timestamp })
    }

    private fun load() {
        viewModelScope.launch {
            try { _state.value = _state.value.copy(loading = false, messages = repo.messages(account, chatId), error = null) }
            catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.message) }
        }
    }

    val playback get() = audio.state

    fun speak(msg: Message) {
        val text = msg.translated ?: msg.body ?: return
        viewModelScope.launch {
            try {
                val r = repo.tts(account, msg.id, text, null)
                audio.toggleBytes("tts-${msg.id}", r.audioBase64, r.mime)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun playVoice(msg: Message, localBase64: String? = null, mime: String? = null) {
        if (localBase64 != null && mime != null) {
            audio.toggleBytes("voice-${msg.id}", localBase64, mime)
            return
        }
        audio.toggleUrl("voice-${msg.id}", media.media(msg.id))
    }

    fun retranscribe(msg: Message) {
        viewModelScope.launch {
            try {
                val t = repo.retranscribe(account, msg.id) ?: return@launch
                upsertPatch(msg.id) { it.copy(transcript = t) }
                val tr = repo.retranslate(account, chatId, msg.id, t)
                if (tr.translated != null) upsertPatch(msg.id) { it.copy(translated = tr.translated) }
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    private fun upsertPatch(id: String, f: (Message) -> Message) {
        _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) f(it) else it })
    }

    /** Tokenised profile-pic URL for the current chat; null if not ready. */
    fun headerAvatarUrl(): String? = media.profilePic(chatId)

    fun onDraft(v: String) { _state.value = _state.value.copy(draft = v) }

    fun startRecording(nowMs: Long) {
        try {
            recorder.start(nowMs)
            _state.value = _state.value.copy(recording = true, recordSecs = 0)
        } catch (e: Exception) {
            _state.value = _state.value.copy(error = e.message)
        }
    }

    fun tickRecording() {
        if (_state.value.recording) {
            _state.value = _state.value.copy(recordSecs = _state.value.recordSecs + 1)
        }
    }

    fun cancelRecording() {
        recorder.cancel()
        _state.value = _state.value.copy(recording = false, recordSecs = 0)
    }

    fun stopRecordingAndTranscribe() {
        val result = recorder.stop()
        _state.value = _state.value.copy(recording = false, recordSecs = 0)
        if (result == null) return
        val (base64, mime) = result
        viewModelScope.launch {
            try {
                val transcript = repo.transcribe(account, base64, mime)
                if (!transcript.isNullOrBlank()) {
                    _state.value = _state.value.copy(draft = transcript)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    fun send() {
        val text = _state.value.draft.trim()
        if (text.isEmpty() || account.isEmpty()) return
        val mode = _state.value.sendMode
        val tLang = _state.value.outLang
        _state.value = _state.value.copy(draft = "", sending = true)
        viewModelScope.launch {
            try {
                if (mode == "voice" && tLang != null) {
                    val r = repo.sendVoice(account, chatId, text, tLang)
                    // optimistic ptt bubble — uses the real returned id so socket echo dedupes
                    r.voiceMsgId?.let { upsert(Message(it, chatId, true, "ptt", null, now(), AckTick.SENT, null, null, null)) }
                    // optimistic text bubble (translation)
                    r.textMsgId?.let { upsert(Message(it, chatId, true, "text", r.sentText ?: text, now(), AckTick.SENT, null, null, null)) }
                } else {
                    val r = repo.send(account, chatId, text, tLang)
                    // optimistic text bubble — real id ensures socket echo is a no-op replace
                    r.msgId?.let { upsert(Message(it, chatId, true, "text", r.sentText ?: text, now(), AckTick.SENT, null, null, null)) }
                }
                _state.value = _state.value.copy(sending = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(sending = false, error = e.message, draft = text)
            }
        }
    }

    private fun now() = System.currentTimeMillis() / 1000

    override fun onCleared() { super.onCleared(); audio.stop() }
}
