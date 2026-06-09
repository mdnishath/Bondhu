package com.bondhu.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.RegisterDeviceRequest
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.data.store.Prefs
import com.bondhu.app.ui.nav.BondhuNavHost
import com.bondhu.app.ui.theme.BondhuTheme
import com.bondhu.app.ui.theme.DarkColors
import com.bondhu.app.ui.theme.LightColors
import com.bondhu.app.ui.theme.ThemeViewModel
import com.bondhu.app.ui.theme.Tokens
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var socket: SocketManager
    @Inject lateinit var prefs: Prefs
    @Inject lateinit var api: BondhuApi

    // Chat to open from a tapped notification (jid to name).
    private val pendingChat = mutableStateOf<Pair<String, String?>?>(null)

    private fun chatFromIntent(i: Intent?): Pair<String, String?>? {
        val jid = i?.getStringExtra("chatJid") ?: return null
        return jid to i.getStringExtra("chatName")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        chatFromIntent(intent)?.let { pendingChat.value = it }
    }

    override fun onStart() {
        super.onStart()
        // Re-establish the realtime socket when the app returns to the foreground.
        socket.connect()
        // Register this device's FCM token for background push (if logged in).
        if (prefs.jwtBlocking() != null) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                lifecycleScope.launch { runCatching { api.registerDevice(RegisterDeviceRequest(token)) } }
            }
        }
    }

    private fun systemDark(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val initialDark = when (prefs.themeBlocking()) { "light" -> false; "dark" -> true; else -> systemDark() }
        Tokens.palette = if (initialDark) DarkColors else LightColors
        pendingChat.value = chatFromIntent(intent)
        enableEdgeToEdge()
        setContent {
            val themeVm: ThemeViewModel = hiltViewModel()
            val mode by themeVm.theme.collectAsStateWithLifecycle()
            val dark = when (mode) { "light" -> false; "dark" -> true; else -> isSystemInDarkTheme() }
            val pc by pendingChat

            // Ask for notification permission once (Android 13+).
            val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
            LaunchedEffect(Unit) {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }

            BondhuTheme(darkTheme = dark) {
                Surface(Modifier.fillMaxSize(), color = Tokens.AppBg) {
                    BondhuNavHost(
                        pendingChatJid = pc?.first,
                        pendingChatName = pc?.second,
                        onChatConsumed = { pendingChat.value = null },
                    )
                }
            }
        }
    }
}
