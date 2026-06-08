package com.bondhu.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.api.MediaUrlBuilder
import com.bondhu.app.data.audio.AudioPlayer
import com.bondhu.app.data.audio.VoiceRecorder
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.ProfileResponse
import com.bondhu.app.data.model.ReactionUi
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
    val retranscribing: Set<String> = emptySet(),
    val replyTo: Message? = null,
    // Contact info
    val contact: ProfileResponse? = null,
    val contactOpen: Boolean = false,
    // Forward
    val forwardChats: List<ChatRow> = emptyList(),
    val forwardTarget: Message? = null,
    // Search
    val searchQuery: String? = null,
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
    private val cache: com.bondhu.app.data.cache.MessageCache,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state
    private var account: String = ""
    private var chatId: String = ""

    fun bind(chatId: String) {
        this.chatId = chatId
        // Seed instantly from the app-scoped cache so a re-opened chat shows its
        // messages with no spinner; the background load() then refreshes them.
        cache.get(chatId)?.let { _state.value = _state.value.copy(messages = it, loading = false) }
        viewModelScope.launch {
            val acct = prefs.activeAccount.first()
            if (acct == null) {
                _state.value = _state.value.copy(loading = false, error = "No active account")
                return@launch
            }
            account = acct
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

    fun ensureLanguages() {
        if (_state.value.supported.isEmpty()) {
            viewModelScope.launch {
                runCatching {
                    _state.value = _state.value.copy(supported = lang.getGlobal().supported)
                }
            }
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

    private fun org.json.JSONObject.strOrNull(key: String): String? =
        if (!has(key) || isNull(key)) null else optString(key).ifEmpty { null }

    private fun onEvent(name: String, payload: org.json.JSONObject) {
        when (name) {
            "message" -> {
                if (payload.optString("chatJid") != chatId) return
                val m = Message(
                    id = payload.optString("msgId"),
                    chatJid = chatId,
                    fromMe = payload.optBoolean("fromMe"),
                    type = payload.optString("type", "text"),
                    body = payload.strOrNull("body"),
                    timestamp = payload.optLong("timestamp"),
                    ack = ackTick(if (payload.has("ack")) payload.optInt("ack") else 0),
                    translated = payload.strOrNull("translated"),
                    transcript = payload.strOrNull("transcript"),
                    senderName = payload.strOrNull("senderName"),
                )
                upsert(m)
                viewModelScope.launch { runCatching { repo.markRead(account, chatId) } }
            }
            "message_ack" -> {
                val id = payload.optString("msgId"); val ack = ackTick(payload.optInt("ack"))
                _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) it.copy(ack = ack) else it })
            }
            "message_reaction" -> {
                val msgId = payload.optString("msgId")
                val emoji = payload.strOrNull("emoji") ?: return
                upsertPatch(msgId) { msg ->
                    val updated = msg.reactions.filterNot { it.emoji == emoji } + ReactionUi(emoji, false)
                    msg.copy(reactions = updated)
                }
            }
            "message_delete" -> {
                val msgId = payload.optString("msgId")
                upsertPatch(msgId) { it.copy(body = "🚫 This message was deleted", type = "deleted") }
            }
            "message_edit" -> {
                val msgId = payload.optString("msgId")
                val newText = payload.strOrNull("text") ?: return
                upsertPatch(msgId) { it.copy(body = newText) }
            }
        }
    }

    private fun upsert(m: Message) {
        val cur = _state.value.messages
        val idx = cur.indexOfFirst { it.id == m.id }
        val next = if (idx >= 0) {
            val existing = cur[idx]
            // Preserve non-null transcript/translated from existing when incoming has null
            // (guards against socket echo carrying nulls overwriting optimistic values)
            val merged = m.copy(
                transcript = m.transcript ?: existing.transcript,
                translated = m.translated ?: existing.translated,
                localImage = m.localImage ?: existing.localImage,
            )
            cur.toMutableList().also { it[idx] = merged }
        } else {
            cur + m
        }
        val sorted = next.sortedBy { it.timestamp }
        cache.put(chatId, sorted)
        _state.value = _state.value.copy(messages = sorted)
    }

    private fun load() {
        viewModelScope.launch {
            try {
                val msgs = repo.messages(account, chatId, limit = 30)
                cache.put(chatId, msgs)
                _state.value = _state.value.copy(loading = false, messages = msgs, error = null)
            } catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.message ?: "Couldn't load messages") }
        }
    }

    /** Re-attempt the initial message load after an error/timeout (retry button). */
    fun retry() {
        if (account.isEmpty()) { bind(chatId); return }
        _state.value = _state.value.copy(loading = true, error = null)
        load()
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
            _state.value = _state.value.copy(retranscribing = _state.value.retranscribing + msg.id)
            try {
                val t = repo.retranscribe(account, msg.id) ?: return@launch
                upsertPatch(msg.id) { it.copy(transcript = t) }
                val tr = repo.retranslate(account, chatId, msg.id, t)
                if (tr.translated != null) upsertPatch(msg.id) { it.copy(translated = tr.translated) }
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            } finally {
                _state.value = _state.value.copy(retranscribing = _state.value.retranscribing - msg.id)
            }
        }
    }

    private fun upsertPatch(id: String, f: (Message) -> Message) {
        _state.value = _state.value.copy(messages = _state.value.messages.map { if (it.id == id) f(it) else it })
    }

    fun setReplyTo(msg: Message) { _state.value = _state.value.copy(replyTo = msg) }
    fun clearReplyTo() { _state.value = _state.value.copy(replyTo = null) }

    fun react(msg: Message, emoji: String) {
        // Optimistically add/update the fromMe reaction
        upsertPatch(msg.id) { m ->
            val updated = m.reactions.filterNot { it.fromMe } + ReactionUi(emoji, true)
            m.copy(reactions = updated)
        }
        viewModelScope.launch { runCatching { repo.react(account, msg.id, emoji) } }
    }

    fun deleteForMe(msg: Message) {
        _state.value = _state.value.copy(messages = _state.value.messages.filter { it.id != msg.id })
        viewModelScope.launch { runCatching { repo.deleteForMe(account, msg.id) } }
    }

    fun deleteForEveryone(msg: Message) {
        upsertPatch(msg.id) { it.copy(body = "🚫 This message was deleted", type = "deleted") }
        viewModelScope.launch { runCatching { repo.deleteForEveryone(account, msg.id) } }
    }

    // --- Contact info ---
    fun openContact() {
        _state.value = _state.value.copy(contactOpen = true)
        viewModelScope.launch {
            runCatching { _state.value = _state.value.copy(contact = repo.profile(account, chatId)) }
        }
    }
    fun closeContact() { _state.value = _state.value.copy(contactOpen = false) }

    // --- Clear chat ---
    fun clearChat() {
        viewModelScope.launch {
            runCatching { repo.clearChat(account, chatId) }
            cache.clear(chatId)
            _state.value = _state.value.copy(messages = emptyList())
        }
    }

    // --- Forward ---
    fun openForward(msg: Message) {
        _state.value = _state.value.copy(forwardTarget = msg)
        viewModelScope.launch {
            runCatching { _state.value = _state.value.copy(forwardChats = repo.chats(account, limit = 100)) }
        }
    }
    fun closeForward() { _state.value = _state.value.copy(forwardTarget = null) }
    fun forward(msg: Message, targetChatIds: List<String>) {
        viewModelScope.launch {
            try {
                repo.forward(account, listOf(msg.id), targetChatIds)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }

    // --- Search ---
    fun setSearch(q: String?) { _state.value = _state.value.copy(searchQuery = q) }

    /** Expose the media builder so ForwardSheet can build profile-pic URLs. */
    val mediaBuilder: MediaUrlBuilder get() = media

    /** Tokenised profile-pic URL for the current chat; null if not ready. */
    fun headerAvatarUrl(): String? = media.profilePic(chatId)

    /** Tokenised media URL for an image message; null if not ready. */
    fun imageUrl(msgId: String): String? = media.media(msgId)

    fun sendImage(base64: String, localUri: String?) {
        if (account.isEmpty()) return
        _state.value = _state.value.copy(sending = true)
        viewModelScope.launch {
            try {
                val r = repo.sendImage(account, chatId, base64, null)
                r.msgId?.let { upsert(Message(it, chatId, true, "image", null, now(), AckTick.SENT, null, null, null, localUri)) }
                _state.value = _state.value.copy(sending = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(sending = false, error = e.message)
            }
        }
    }

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
        val replyTarget = _state.value.replyTo
        _state.value = _state.value.copy(draft = "", sending = true, replyTo = null)
        viewModelScope.launch {
            try {
                if (replyTarget != null) {
                    // Text reply (voice reply not supported)
                    val r = repo.reply(account, chatId, replyTarget.id, text)
                    r.msgId?.let { upsert(Message(it, chatId, true, "text", r.sentText ?: text, now(), AckTick.SENT, null, null, null)) }
                } else if (mode == "voice" && tLang != null) {
                    val r = repo.sendVoice(account, chatId, text, tLang)
                    // optimistic ptt bubble — uses the real returned id so socket echo dedupes;
                    // store sentText as transcript so the voice bubble shows the sent caption
                    r.voiceMsgId?.let { upsert(Message(it, chatId, true, "ptt", null, now(), AckTick.SENT, null, r.sentText, null)) }
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

    private fun now() = System.currentTimeMillis() // epoch millis, matches server

    override fun onCleared() { super.onCleared(); audio.stop() }
}
