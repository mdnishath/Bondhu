package com.bondhu.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.repository.AccountRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PairUiState(
    val qr: String? = null,
    val pairingCode: String? = null,
    val state: String = "connecting",
    val phone: String = "",
    val connected: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PairViewModel @Inject constructor(
    private val repo: AccountRepository,
    private val socket: SocketManager,
    private val prefs: Prefs,
) : ViewModel() {

    private val _state = MutableStateFlow(PairUiState())
    val state: StateFlow<PairUiState> = _state
    private var accountId: String = ""

    fun bind(accountId: String) {
        this.accountId = accountId
        socket.connect()
        // Fallback status poll loop: the socket `connected` event can be missed
        // (emitted before the socket joins the room, or while backgrounded), which
        // left the screen stuck with no redirect/success. Poll every 2.5s until
        // connected so the link is detected reliably even without the socket event.
        viewModelScope.launch {
            poll()
            while (!_state.value.connected) {
                kotlinx.coroutines.delay(2500)
                poll()
            }
            // Linked — make this the active account so the redirect lands in chats.
            runCatching { prefs.setActiveAccount(accountId) }
        }
        viewModelScope.launch {
            socket.events.collect { ev ->
                if (ev.name != "status") return@collect
                if (ev.payload.optString("accountId") != accountId) return@collect
                val st = ev.payload.optString("status")
                _state.value = _state.value.copy(
                    state = st,
                    qr = ev.payload.optString("qr").ifEmpty { _state.value.qr },
                    pairingCode = ev.payload.optString("code").ifEmpty { _state.value.pairingCode },
                    connected = st == "connected" || _state.value.connected,
                )
            }
        }
    }

    private suspend fun poll() {
        try {
            val s = repo.status(accountId)
            _state.value = _state.value.copy(
                state = s.state, qr = s.qr ?: _state.value.qr,
                pairingCode = s.pairingCode ?: _state.value.pairingCode,
                connected = s.connected || _state.value.connected,
            )
        } catch (_: Exception) { /* socket / next poll will deliver updates */ }
    }

    fun onPhone(v: String) { _state.value = _state.value.copy(phone = v) }

    fun requestPairingCode() {
        val phone = _state.value.phone.filter { it.isDigit() }
        if (phone.isEmpty()) { _state.value = _state.value.copy(error = "Enter phone number"); return }
        viewModelScope.launch {
            try { repo.pair(accountId, phone); poll() }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
}
