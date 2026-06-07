package com.bondhu.app

import com.bondhu.app.data.api.AuthInterceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthInterceptorTest {
    @Test fun addsBearerHeader_whenTokenPresent() {
        val server = MockWebServer().apply { enqueue(MockResponse().setBody("{}")); start() }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenProvider = { "abc123" }))
            .build()
        client.newCall(Request.Builder().url(server.url("/api/me")).build()).execute().close()
        val recorded = server.takeRequest()
        assertEquals("Bearer abc123", recorded.getHeader("Authorization"))
        server.shutdown()
    }

    @Test fun noHeader_whenTokenNull() {
        val server = MockWebServer().apply { enqueue(MockResponse().setBody("{}")); start() }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenProvider = { null }))
            .build()
        client.newCall(Request.Builder().url(server.url("/api/login")).build()).execute().close()
        val recorded = server.takeRequest()
        assertEquals(null, recorded.getHeader("Authorization"))
        server.shutdown()
    }
}
