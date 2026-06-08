package com.bondhu.app.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.model.ApiKeyDto
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.data.repository.LanguageRepository
import com.bondhu.app.data.repository.SettingsRepository
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val keys: List<ApiKeyDto> = emptyList(),
    val globalLang: String = "",
    val supported: List<LangOption> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val testing: Boolean = false,
    val theme: String = "system",
    val currentVersion: String = "",
    val update: com.bondhu.app.data.update.UpdateInfo? = null,
    val checkingUpdate: Boolean = false,
    val upToDate: Boolean = false,
    val newKeyValue: String = "",
    val newKeyLabel: String = "",
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsRepo: SettingsRepository,
    private val langRepo: LanguageRepository,
    private val prefs: Prefs,
    private val socket: SocketManager,
    private val updateManager: com.bondhu.app.data.update.UpdateManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state

    init {
        _state.value = _state.value.copy(theme = prefs.themeBlocking(), currentVersion = updateManager.currentVersion)
        load()
    }

    fun checkUpdate() {
        _state.value = _state.value.copy(checkingUpdate = true, upToDate = false)
        viewModelScope.launch {
            val u = updateManager.check()
            _state.value = _state.value.copy(checkingUpdate = false, update = u, upToDate = (u == null))
        }
    }

    fun runUpdate() {
        _state.value.update?.let {
            updateManager.startDownload(it)
            _state.value = _state.value.copy(notice = "Downloading update… check your notifications")
        }
    }

    fun setTheme(mode: String) {
        _state.value = _state.value.copy(theme = mode)
        viewModelScope.launch { prefs.setTheme(mode) }
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val keys = settingsRepo.getKeys()
                val langResp = langRepo.getGlobal()
                _state.value = _state.value.copy(
                    loading = false,
                    keys = keys,
                    globalLang = langResp.lang,
                    supported = langResp.supported,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Failed to load settings")
            }
        }
    }

    fun onNewKeyValue(v: String) { _state.value = _state.value.copy(newKeyValue = v) }
    fun onNewKeyLabel(v: String) { _state.value = _state.value.copy(newKeyLabel = v) }
    fun clearError() { _state.value = _state.value.copy(error = null) }
    fun clearNotice() { _state.value = _state.value.copy(notice = null) }

    /** Verify the active API key works via a tiny Gemini call. */
    fun testKey() {
        viewModelScope.launch {
            _state.value = _state.value.copy(testing = true)
            try {
                val r = settingsRepo.testKey()
                _state.value = _state.value.copy(
                    testing = false,
                    notice = if (r.ok) "API key works ✓" else "Key failed: ${r.error ?: "invalid or restricted"}",
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(testing = false, error = e.message ?: "Test failed")
            }
        }
    }

    fun addKey() {
        val s = _state.value
        if (s.newKeyValue.isBlank()) {
            _state.value = s.copy(error = "Key value is required"); return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                settingsRepo.addKey(s.newKeyValue.trim(), s.newKeyLabel.trim().ifBlank { null })
                _state.value = _state.value.copy(loading = false, newKeyValue = "", newKeyLabel = "")
                // reload keys
                val keys = settingsRepo.getKeys()
                _state.value = _state.value.copy(keys = keys)
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = e.message ?: "Failed to add key")
            }
        }
    }

    fun deleteKey(id: String) {
        viewModelScope.launch {
            try {
                settingsRepo.deleteKey(id)
                val keys = settingsRepo.getKeys()
                _state.value = _state.value.copy(keys = keys)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message ?: "Failed to delete key")
            }
        }
    }

    fun activateKey(id: String) {
        viewModelScope.launch {
            try {
                settingsRepo.activateKey(id)
                val keys = settingsRepo.getKeys()
                _state.value = _state.value.copy(keys = keys)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message ?: "Failed to activate key")
            }
        }
    }

    fun setLanguage(code: String) {
        viewModelScope.launch {
            try {
                langRepo.setGlobal(code)
                _state.value = _state.value.copy(globalLang = code)
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = e.message ?: "Failed to set language")
            }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            prefs.setJwt(null)
            prefs.setActiveAccount(null)
            socket.disconnect()
            onDone()
        }
    }
}
