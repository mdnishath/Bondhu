package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.ChatRepository
import com.bondhu.app.data.repository.LanguageRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class Layer1RepoTest {
    private fun api(s: MockWebServer) = Retrofit.Builder().baseUrl(s.url("/")).client(OkHttpClient())
        .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build())).build().create(BondhuApi::class.java)

    @Test fun tts_returnsAudio() = runTest {
        val s = MockWebServer().apply { enqueue(MockResponse().setBody("""{"audioBase64":"AAA","mime":"audio/wav"}""")); start() }
        val r = ChatRepository(api(s))
        val res = r.tts("acc","m1","hi","en")
        assertEquals("AAA", res.audioBase64); assertEquals("audio/wav", res.mime)
        assertEquals("/api/tts", s.takeRequest().path); s.shutdown()
    }
    @Test fun sendVoice_returnsIds() = runTest {
        val s = MockWebServer().apply { enqueue(MockResponse().setBody("""{"success":true,"voiceMsgId":"v1","textMsgId":"t1","sentText":"salut","audioBase64":"AA","mime":"audio/wav"}""")); start() }
        val res = ChatRepository(api(s)).sendVoice("acc","c@lid","hi","fr")
        assertEquals("v1", res.voiceMsgId); assertEquals("t1", res.textMsgId); assertEquals("salut", res.sentText); s.shutdown()
    }
    @Test fun language_listAndPerChat() = runTest {
        val s = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"lang":"bn","supported":[{"code":"bn","name":"Bengali","flag":"BD"},{"code":"en","name":"English","flag":"US"}]}"""))
            enqueue(MockResponse().setBody("""{"lang":"fr"}"""))
            start()
        }
        val lr = LanguageRepository(api(s))
        val g = lr.getGlobal(); assertEquals("bn", g.lang); assertEquals(2, g.supported.size)
        assertEquals("fr", lr.getChat("acc","c@lid")); s.shutdown()
    }
}
