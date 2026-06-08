package com.bondhu.app.data.model

enum class AckTick { NONE, SENT, DELIVERED, READ }

data class Account(
    val id: String,
    val label: String,
    val phone: String?,
    val status: String,
    val qr: String?,
)

data class ChatRow(
    val jid: String,
    val title: String,
    val preview: String,
    val timestamp: Long, // epoch millis
    val unread: Int,
)

data class ReactionUi(val emoji: String, val fromMe: Boolean)

data class Message(
    val id: String,
    val chatJid: String,
    val fromMe: Boolean,
    val type: String,
    val body: String?,
    val timestamp: Long,
    val ack: AckTick,
    val translated: String?,
    val transcript: String?,
    val senderName: String?,
    val localImage: String? = null,  // local content-Uri string for an own just-sent image (session-only)
    val reactions: List<ReactionUi> = emptyList(),
)
