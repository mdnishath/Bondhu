package com.bondhu.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.repository.AccountRepository
import com.bondhu.app.data.socket.SocketManager
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
) : ViewModel() {

    private val _state = MutableStateFlow(PairUiState())
    val state: StateFlow<PairUiState> = _state
    private var accountId: String = ""

    fun bind(accountId: String) {
        this.accountId = accountId
        socket.connect()
        poll()
        viewModelScope.launch {
            socket.events.collect { ev ->
                if (ev.name != "status") return@collect
                if (ev.payload.optString("accountId") != accountId) return@collect
                val st = ev.payload.optString("status")
                _state.value = _state.value.copy(
                    state = st,
                    qr = ev.payload.optString("qr").ifEmpty { _state.value.qr },
                    pairingCode = ev.payload.optString("code").ifEmpty { _state.value.pairingCode },
                    connected = st == "connected",
                )
            }
        }
    }

    private fun poll() {
        viewModelScope.launch {
            try {
                val s = repo.status(accountId)
                _state.value = _state.value.copy(
                    state = s.state, qr = s.qr ?: _state.value.qr,
                    pairingCode = s.pairingCode ?: _state.value.pairingCode, connected = s.connected,
                )
            } catch (_: Exception) { /* socket will deliver updates */ }
        }
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
