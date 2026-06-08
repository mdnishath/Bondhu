package com.bondhu.app.data.model

fun ackTick(ack: Int?): AckTick = when (ack ?: 0) {
    0 -> AckTick.NONE
    1 -> AckTick.SENT
    2 -> AckTick.DELIVERED
    else -> AckTick.READ // 3 = read, 4 = played -> show read
}

fun AccountDto.toUi(): Account = Account(
    id = id,
    label = (label?.takeIf { it.isNotBlank() }) ?: (phone ?: "WhatsApp account"),
    phone = phone,
    status = status,
    qr = qr,
)

fun ChatDto.toUi(): ChatRow = ChatRow(
    jid = jid,
    title = (name?.takeIf { it.isNotBlank() }) ?: ("+" + jid.substringBefore("@")),
    preview = lastMessagePreview ?: "",
    timestamp = lastMessageAt ?: 0L,
    unread = unreadCount,
)

fun MessageDto.toUi(): Message = Message(
    id = msgId,
    chatJid = chatJid,
    fromMe = fromMe,
    type = type,
    body = body,
    timestamp = timestamp,
    ack = ackTick(ack),
    translated = translated,
    transcript = transcript,
    senderName = senderName,
    reactions = reactions.map { ReactionUi(it.emoji, it.fromMe) },
)
