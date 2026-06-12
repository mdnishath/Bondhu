package com.bondhu.app

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

class ChatRepositoryTest {
    @Test fun chats_mapToRows() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"chats":[{"jid":"c@lid","name":"Ammu","isGroup":false,"lastMessageAt":99,"lastMessagePreview":"hi","unreadCount":2}]}"""))
            start()
        }
        val repo = chatRepoFor(server)
        val rows = repo.chats("acc1")
        assertEquals(1, rows.size)
        assertEquals("Ammu", rows[0].title)
        assertEquals(2, rows[0].unread)
        server.shutdown()
    }

    @Test fun transcribe_usesMediaClientEndpoint() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"transcript":"আমি আসবো"}"""))
            start()
        }
        val repo = chatRepoFor(server)
        val t = repo.transcribe("acc1", "AAAA", "audio/mp4")
        assertEquals("আমি আসবো", t)
        assertEquals("/api/transcribe", server.takeRequest().path)
        server.shutdown()
    }
}
