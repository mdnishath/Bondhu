package com.bondhu.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.repository.AuthRepository
import com.bondhu.app.data.socket.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isRegister: Boolean = false,
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repo: AuthRepository,
    private val socket: SocketManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun toggleMode() { _state.value = _state.value.copy(isRegister = !_state.value.isRegister, error = null) }
    fun onEmail(v: String) { _state.value = _state.value.copy(email = v) }
    fun onPassword(v: String) { _state.value = _state.value.copy(password = v) }
    fun onName(v: String) { _state.value = _state.value.copy(name = v) }
    fun clearError() { _state.value = _state.value.copy(error = null) }

    fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank()) {
            _state.value = s.copy(error = "Email and password required"); return
        }
        _state.value = s.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                if (s.isRegister) repo.register(s.email, s.password, s.name)
                else repo.login(s.email, s.password)
                socket.reset()
                _state.value = _state.value.copy(loading = false, success = true)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Login failed")
            }
        }
    }
}
