package com.bondhu.app.ui.nav

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GateViewModel @Inject constructor(
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {
    private val _start = MutableStateFlow<String?>(null)
    val start: StateFlow<String?> = _start

    init {
        viewModelScope.launch {
            val jwt = prefs.jwt.first()
            val account = prefs.activeAccount.first()
            _start.value = when {
                jwt.isNullOrEmpty() -> Routes.AUTH
                account.isNullOrEmpty() -> Routes.ACCOUNTS
                else -> { socket.connect(); Routes.CHAT_LIST }
            }
        }
    }
}
