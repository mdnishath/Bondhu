package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class ChatRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun chats_mapToRows() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"chats":[{"jid":"c@lid","name":"Ammu","isGroup":false,"lastMessageAt":99,"lastMessagePreview":"hi","unreadCount":2}]}"""))
            start()
        }
        val repo = ChatRepository(apiFor(server))
        val rows = repo.chats("acc1")
        assertEquals(1, rows.size)
        assertEquals("Ammu", rows[0].title)
        assertEquals(2, rows[0].unread)
        server.shutdown()
    }
}
