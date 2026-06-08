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

class L2CRepoTest {
    private fun api(s: MockWebServer) = Retrofit.Builder()
        .baseUrl(s.url("/")).client(OkHttpClient())
        .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
        .build().create(BondhuApi::class.java)

    @Test fun clearChat_callsCorrectEndpoint() = runTest {
        val s = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"success":true}"""))
            start()
        }
        val repo = ChatRepository(api(s))
        val result = repo.clearChat("acc1", "chat@lid")
        assertTrue(result.success)
        val req = s.takeRequest()
        // Retrofit does not percent-encode '@' in @Path by default
        assertEquals("/api/chats/chat@lid/clear?account=acc1", req.path)
        s.shutdown()
    }

    @Test fun forward_postsBody() = runTest {
        val s = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"success":true}"""))
            start()
        }
        val repo = ChatRepository(api(s))
        val result = repo.forward("acc1", listOf("msg1", "msg2"), listOf("target@lid"))
        assertTrue(result.success)
        val req = s.takeRequest()
        assertEquals("/api/forward", req.path)
        val body = req.body.readUtf8()
        assertTrue(body.contains("\"account\":\"acc1\""))
        assertTrue(body.contains("\"msgIds\":[\"msg1\",\"msg2\"]"))
        assertTrue(body.contains("\"targetChatIds\":[\"target@lid\"]"))
        s.shutdown()
    }
}
