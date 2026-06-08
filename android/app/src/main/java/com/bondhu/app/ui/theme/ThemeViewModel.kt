package com.bondhu.app.ui.theme

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bondhu.app.data.store.Prefs
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/** Exposes the persisted theme mode ("system" | "light" | "dark") for the root UI. */
@HiltViewModel
class ThemeViewModel @Inject constructor(prefs: Prefs) : ViewModel() {
    val theme: StateFlow<String> =
        prefs.theme.stateIn(viewModelScope, SharingStarted.Eagerly, prefs.themeBlocking())
}
