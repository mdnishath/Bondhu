package com.bondhu.app

import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.ChatDto
import com.bondhu.app.data.model.MessageDto
import com.bondhu.app.data.model.ackTick
import com.bondhu.app.data.model.toUi
import org.junit.Assert.assertEquals
import org.junit.Test

class MappersTest {
    @Test fun ackTick_maps() {
        assertEquals(AckTick.NONE, ackTick(0))
        assertEquals(AckTick.SENT, ackTick(1))
        assertEquals(AckTick.DELIVERED, ackTick(2))
        assertEquals(AckTick.READ, ackTick(3))
        assertEquals(AckTick.READ, ackTick(4))
    }

    @Test fun messageDto_mapsToUi() {
        val dto = MessageDto(
            msgId = "m1", chatJid = "c@lid", fromMe = true, type = "text",
            body = "hi", timestamp = 1000L, ack = 2, translated = "salut", transcript = null, senderName = null,
        )
        val ui = dto.toUi()
        assertEquals("m1", ui.id)
        assertEquals(true, ui.fromMe)
        assertEquals("hi", ui.body)
        assertEquals("salut", ui.translated)
        assertEquals(AckTick.DELIVERED, ui.ack)
    }

    @Test fun chatDto_mapsToUi_unreadAndPreview() {
        val dto = ChatDto(
            jid = "c@lid", name = "Ammu", isGroup = false,
            lastMessageAt = 1234L, lastMessagePreview = "hello", unreadCount = 3,
        )
        val ui = dto.toUi()
        assertEquals("Ammu", ui.title)
        assertEquals(3, ui.unread)
        assertEquals("hello", ui.preview)
    }

    @Test fun chatDto_nullName_fallsBackToJidPrefix() {
        val ui = ChatDto(jid = "8801712345678@s.whatsapp.net").toUi()
        assertEquals("+8801712345678", ui.title)
    }
}
