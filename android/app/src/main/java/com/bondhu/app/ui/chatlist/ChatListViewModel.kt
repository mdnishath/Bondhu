package com.bondhu.app.ui.chatlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.api.MediaUrlBuilder
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatListUiState(
    val loading: Boolean = true,
    val chats: List<ChatRow> = emptyList(),
    val account: String? = null,
    val error: String? = null,
)

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val repo: ChatRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
    private val media: MediaUrlBuilder,
) : ViewModel() {

    private val _state = MutableStateFlow(ChatListUiState())
    val state: StateFlow<ChatListUiState> = _state

    init {
        viewModelScope.launch {
            _state.value = _state.value.copy(account = prefs.activeAccount.first())
            refresh()
        }
        // Re-sync on any new message / chat update / socket reconnect.
        viewModelScope.launch { socket.events.collect { if (it.name == "message" || it.name == "chat_update") refresh() } }
        viewModelScope.launch { socket.connects.collect { refresh() } }
    }

    fun refresh() {
        val acc = _state.value.account ?: return
        viewModelScope.launch {
            try { _state.value = _state.value.copy(loading = false, chats = repo.chats(acc), error = null) }
            catch (e: Exception) { _state.value = _state.value.copy(loading = false, error = e.message) }
        }
    }

    /** Tokenised profile-pic URL for [jid]; null if not ready. Cheap string build — Coil caches the fetch. */
    fun avatarUrl(jid: String): String? = media.profilePic(jid)
}
