package com.bondhu.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.bondhu.app.data.socket.SocketManager
import com.bondhu.app.ui.nav.BondhuNavHost
import com.bondhu.app.ui.theme.BondhuTheme
import com.bondhu.app.ui.theme.Tokens
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var socket: SocketManager

    override fun onStart() {
        super.onStart()
        // Re-establish the realtime socket when the app returns to the foreground —
        // the OS may have torn it down while backgrounded. No-op if not logged in
        // (no JWT) or already connected.
        socket.connect()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BondhuTheme {
                Surface(Modifier.fillMaxSize(), color = Tokens.AppBg) {
                    BondhuNavHost()
                }
            }
        }
    }
}
