package com.bondhu.app.data.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.bondhu.app.R
import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.RegisterDeviceRequest
import com.bondhu.app.data.store.Prefs
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BondhuMessagingService : FirebaseMessagingService() {
    @Inject lateinit var api: BondhuApi
    @Inject lateinit var prefs: Prefs
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        scope.launch { if (prefs.jwtBlocking() != null) runCatching { api.registerDevice(RegisterDeviceRequest(token)) } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "Bondhu"
        val body = message.notification?.body ?: message.data["preview"] ?: "New message"
        showNotification(title, body, message.data["chatJid"])
    }

    private fun showNotification(title: String, body: String, chatJid: String?) {
        val nm = getSystemService(NotificationManager::class.java)
        val channelId = "messages"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(channelId, "Messages", NotificationManager.IMPORTANCE_HIGH))
        }
        // Carry the chat id so tapping the notification opens THAT chat (not the list).
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (chatJid != null) { putExtra("chatJid", chatJid); putExtra("chatName", title) }
        }
        val pi = PendingIntent.getActivity(
            this, chatJid?.hashCode() ?: 0, launch,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notif = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), notif)
    }
}
