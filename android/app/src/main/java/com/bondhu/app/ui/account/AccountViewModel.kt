package com.bondhu.app.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.model.Account
import com.bondhu.app.data.repository.AccountRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountListUiState(
    val loading: Boolean = true,
    val accounts: List<Account> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val repo: AccountRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AccountListUiState())
    val state: StateFlow<AccountListUiState> = _state

    init {
        refresh()
        viewModelScope.launch {
            socket.events.collect { ev ->
                if (ev.name == "status") refresh()
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                // Only show the full-screen spinner on the very first load — later
                // refreshes (e.g. streamed `status` events during pairing) update the
                // list in place instead of flickering a spinner over it.
                if (_state.value.accounts.isEmpty()) _state.value = _state.value.copy(loading = true, error = null)
                _state.value = _state.value.copy(loading = false, accounts = repo.list(), error = null)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message)
            }
        }
    }

    /** Create (or reuse) a pending account and return its id for the Pair screen. */
    fun addAccount(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            try { onCreated(repo.add()) }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }

    fun selectAccount(id: String, onSelected: () -> Unit) {
        viewModelScope.launch {
            prefs.setActiveAccount(id)
            socket.reset()
            onSelected()
        }
    }

    fun removeAccount(id: String) {
        viewModelScope.launch {
            try { repo.remove(id); refresh() }
            catch (e: Exception) { _state.value = _state.value.copy(error = e.message) }
        }
    }
}
