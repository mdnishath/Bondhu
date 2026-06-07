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
        val repo = ChatRepository(apiFor(server))
        val res = repo.send("acc1", "c@lid", "hi", null)
        assertEquals("m9", res.msgId)
        val recorded = server.takeRequest()
        assertEquals("/api/send", recorded.path)
        assertTrue(recorded.body.readUtf8().contains("\"chatId\":\"c@lid\""))
        server.shutdown()
    }

    @Test fun messages_mapNewestLast() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"lang":"bn","messages":[{"msgId":"m1","chatJid":"c@lid","fromMe":false,"type":"text","body":"hi","timestamp":1,"ack":0},{"msgId":"m2","chatJid":"c@lid","fromMe":true,"type":"text","body":"yo","timestamp":2,"ack":2}]}"""))
            start()
        }
        val repo = ChatRepository(apiFor(server))
        val msgs = repo.messages("acc1", "c@lid")
        assertEquals(2, msgs.size)
        assertEquals("m1", msgs[0].id)
        server.shutdown()
    }
}
