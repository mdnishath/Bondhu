package com.bondhu.app

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import com.bondhu.app.ui.nav.BondhuNavHost
import com.bondhu.app.ui.theme.BondhuTheme
import com.bondhu.app.ui.theme.DarkColors
import com.bondhu.app.ui.theme.LightColors
import com.bondhu.app.ui.theme.ThemeViewModel
import com.bondhu.app.ui.theme.Tokens
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var socket: SocketManager
    @Inject lateinit var prefs: Prefs

    override fun onStart() {
        super.onStart()
        // Re-establish the realtime socket when the app returns to the foreground.
        socket.connect()
    }

    private fun systemDark(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Seed the palette from the cached pref before first composition (no flash).
        val initialDark = when (prefs.themeBlocking()) { "light" -> false; "dark" -> true; else -> systemDark() }
        Tokens.palette = if (initialDark) DarkColors else LightColors
        enableEdgeToEdge()
        setContent {
            val themeVm: ThemeViewModel = hiltViewModel()
            val mode by themeVm.theme.collectAsStateWithLifecycle()
            val dark = when (mode) {
                "light" -> false
                "dark" -> true
                else -> isSystemInDarkTheme()
            }
            BondhuTheme(darkTheme = dark) {
                Surface(Modifier.fillMaxSize(), color = Tokens.AppBg) {
                    BondhuNavHost()
                }
            }
        }
    }
}
