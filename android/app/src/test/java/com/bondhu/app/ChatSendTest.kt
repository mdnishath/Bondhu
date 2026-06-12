package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class ChatSendTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun send_postsBodyAndReturnsMsgId() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"success":true,"msgId":"m9","sentText":"hi","original":null}"""))
            start()
        }
        val repo = chatRepoFor(server)
        val res = repo.send("acc1", "c@lid", "hi", null)
        assertEquals("m9", res.msgId)
        val recorded = server.takeRequest()
        assertEquals("/api/send", recorded.path)
        assertTrue(recorded.body.readUtf8().contains("\"chatId\":\"c@lid\""))
        server.shutdown()
    }

    @Test fun sendImage_postsBodyAndReturnsMsgId() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"success":true,"msgId":"img1"}"""))
            start()
        }
        val repo = chatRepoFor(server)
        val res = repo.sendImage("acc1", "c@lid", "base64data==", "nice photo")
        assertEquals("img1", res.msgId)
        val recorded = server.takeRequest()
        assertEquals("/api/send-image", recorded.path)
        val body = recorded.body.readUtf8()
        assertTrue(body.contains("\"chatId\":\"c@lid\""))
        assertTrue(body.contains("\"imageBase64\":\"base64data==\""))
        assertTrue(body.contains("\"caption\":\"nice photo\""))
        server.shutdown()
    }

    @Test fun messages_returnedOldestFirst() = runTest {
        // Server returns newest-first (DESC); repo must return oldest-first for display.
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"lang":"bn","messages":[{"msgId":"m2","chatJid":"c@lid","fromMe":true,"type":"text","body":"yo","timestamp":2,"ack":2},{"msgId":"m1","chatJid":"c@lid","fromMe":false,"type":"text","body":"hi","timestamp":1,"ack":0}]}"""))
            start()
        }
        val repo = chatRepoFor(server)
        val msgs = repo.messages("acc1", "c@lid")
        assertEquals(2, msgs.size)
        assertEquals("m1", msgs.first().id)   // oldest first
        assertEquals("m2", msgs.last().id)    // newest last
        server.shutdown()
    }
}
