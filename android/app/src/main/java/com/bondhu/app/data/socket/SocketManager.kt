package com.bondhu.app.data.socket

import com.bondhu.app.data.store.Prefs
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/** A backend Socket.IO event with its JSON payload (always carries accountId). */
data class SocketEvent(val name: String, val payload: JSONObject)

@Singleton
class SocketManager @Inject constructor(private val prefs: Prefs) {

    private var socket: Socket? = null

    private val _events = MutableSharedFlow<SocketEvent>(
        extraBufferCapacity = 64, onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events: SharedFlow<SocketEvent> = _events

    // Emitted whenever the socket (re)connects, so screens can re-sync.
    private val _connects = MutableSharedFlow<Unit>(extraBufferCapacity = 4, onBufferOverflow = BufferOverflow.DROP_OLDEST)
    val connects: SharedFlow<Unit> = _connects

    // Live connection state — drives the "Reconnecting…" banner.
    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected

    private val forwarded = listOf(
        "status", "message", "message_ack", "chat_update",
        "message_reaction", "message_delete", "message_edit", "presence",
    )

    @Synchronized
    fun connect() {
        if (socket?.connected() == true) return
        val token = prefs.jwtBlocking() ?: return
        val base = prefs.baseUrlBlocking()
        val opts = IO.Options().apply {
            auth = mapOf("token" to token)
            reconnection = true
            transports = arrayOf("websocket")
        }
        val s = IO.socket(base, opts)
        s.on(Socket.EVENT_CONNECT) { _connects.tryEmit(Unit); _connected.value = true }
        s.on(Socket.EVENT_DISCONNECT) { _connected.value = false }
        forwarded.forEach { name ->
            s.on(name) { args ->
                val obj = args.firstOrNull() as? JSONObject ?: JSONObject()
                _events.tryEmit(SocketEvent(name, obj))
            }
        }
        socket = s
        s.connect()
    }

    @Synchronized
    fun disconnect() {
        socket?.let { it.off(); it.disconnect(); it.close() }
        socket = null
        _connected.value = false
    }

    /** Reconnect with the latest token/base (call after login or server change). */
    @Synchronized
    fun reset() {
        disconnect()
        connect()
    }
}
