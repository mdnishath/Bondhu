package com.bondhu.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.audio.AudioPlayer
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.ackTick
import com.bondhu.app.data.repository.ChatRepository
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
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
    private val audio: AudioPlayer,
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
            runCatching { repo.markRead(account, chatId) }
        }
        viewModelScope.launch { socket.events.collect { onEvent(it.name, it.payload) } }
        viewModelScope.launch { socket.connects.collect { load() } }
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

    fun onDraft(v: String) { _state.value = _state.value.copy(draft = v) }

    fun send() {
        val text = _state.value.draft.trim()
        if (text.isEmpty() || account.isEmpty()) return
        _state.value = _state.value.copy(draft = "", sending = true)
        viewModelScope.launch {
            try {
                val res = repo.send(account, chatId, text, translateTo = null)
                if (res.msgId != null) upsert(
                    // timestamp in epoch SECONDS to match server-delivered messages
                    Message(res.msgId, chatId, true, "text", res.sentText ?: text, System.currentTimeMillis() / 1000, AckTick.SENT, null, null, null)
                )
                _state.value = _state.value.copy(sending = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(sending = false, error = e.message, draft = text)
            }
        }
    }
}
