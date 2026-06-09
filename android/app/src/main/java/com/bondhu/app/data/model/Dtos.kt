package com.bondhu.app.data.model

import com.squareup.moshi.JsonClass

// --- Auth ---
@JsonClass(generateAdapter = true)
data class AuthRequest(val email: String, val password: String, val name: String? = null)

@JsonClass(generateAdapter = true)
data class UserDto(val id: String, val email: String, val name: String?)

@JsonClass(generateAdapter = true)
data class AuthResponse(val token: String, val user: UserDto)

// --- Accounts ---
@JsonClass(generateAdapter = true)
data class AccountDto(
    val id: String,
    val label: String?,
    val phone: String?,
    val status: String,
    val qr: String? = null,
)

@JsonClass(generateAdapter = true)
data class AccountsResponse(val accounts: List<AccountDto>)

@JsonClass(generateAdapter = true)
data class CreateAccountRequest(val label: String? = null)

@JsonClass(generateAdapter = true)
data class CreateAccountResponse(val accountId: String)

@JsonClass(generateAdapter = true)
data class PairRequest(val phone: String)

@JsonClass(generateAdapter = true)
data class StatusResponse(
    val connected: Boolean,
    val state: String,
    val phoneNumber: String? = null,
    val qr: String? = null,
    val pairingCode: String? = null,
)

// --- Chats / messages ---
// Matches ChatsRepo.map(): { jid, name, isGroup, lastMessageAt, lastMessagePreview, unreadCount }
@JsonClass(generateAdapter = true)
data class ChatDto(
    val jid: String,
    val name: String? = null,
    val isGroup: Boolean = false,
    val lastMessageAt: Long? = null,
    val lastMessagePreview: String? = null,
    val unreadCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ChatsResponse(val chats: List<ChatDto>)

@JsonClass(generateAdapter = true)
data class ReactionDto(
    val senderJid: String? = null,
    val emoji: String,
    val fromMe: Boolean = false,
)

// Matches MessagesRepo.map() + route extras. `timestamp` is epoch MILLISECONDS
// (normalize.ts converts Baileys seconds→ms; outgoing uses Date.now()). Format with
// Date(ts) directly — do NOT multiply by 1000.
@JsonClass(generateAdapter = true)
data class MessageDto(
    val msgId: String,
    val chatJid: String,
    val fromMe: Boolean,
    val type: String,
    val body: String? = null,
    val timestamp: Long,
    val ack: Int? = null,
    val translated: String? = null,
    val transcript: String? = null,
    val senderName: String? = null,
    val reactions: List<ReactionDto> = emptyList(),
    val quotedId: String? = null,
    val quotedText: String? = null,
)

@JsonClass(generateAdapter = true)
data class MessagesResponse(val lang: String?, val messages: List<MessageDto>)

@JsonClass(generateAdapter = true)
data class SendRequest(
    val account: String,
    val chatId: String,
    val message: String,
    val translateTo: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendResponse(
    val success: Boolean,
    val msgId: String? = null,
    val sentText: String? = null,
    val original: String? = null,
)

@JsonClass(generateAdapter = true)
data class OkResponse(val success: Boolean = true)

// --- Message action requests ---
@JsonClass(generateAdapter = true)
data class ReactRequest(val account: String, val msgId: String, val emoji: String)

@JsonClass(generateAdapter = true)
data class ReplyRequest(val account: String, val chatId: String, val msgId: String, val text: String)

@JsonClass(generateAdapter = true)
data class MsgIdRequest(val account: String, val msgId: String)

@JsonClass(generateAdapter = true)
data class ForwardRequest(val account: String, val msgIds: List<String>, val targetChatIds: List<String>)

@JsonClass(generateAdapter = true)
data class EditMessageRequest(val account: String, val msgId: String, val text: String)

@JsonClass(generateAdapter = true)
data class JidRequest(val jid: String)

@JsonClass(generateAdapter = true)
data class TypingRequest(val jid: String, val on: Boolean)

@JsonClass(generateAdapter = true)
data class TestKeyResponse(val ok: Boolean = false, val error: String? = null)

@JsonClass(generateAdapter = true)
data class RegisterDeviceRequest(val token: String, val platform: String = "android")

@JsonClass(generateAdapter = true)
data class SendDocumentRequest(
    val account: String,
    val chatId: String,
    val fileBase64: String,
    val fileName: String,
    val mimeType: String,
)

@JsonClass(generateAdapter = true)
data class LatestVersionResponse(val versionName: String? = null, val url: String? = null, val notes: String? = null)
