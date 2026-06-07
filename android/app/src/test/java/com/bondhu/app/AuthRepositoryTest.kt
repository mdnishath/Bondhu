package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.AuthRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AuthRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/"))
            .client(OkHttpClient()).addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun login_returnsTokenAndUser() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"token":"tok","user":{"id":"u1","email":"a@b.com","name":"A"}}"""))
            start()
        }
        val tokens = mutableListOf<String?>()
        val repo = AuthRepository(apiFor(server), saveToken = { tokens.add(it) })
        val res = repo.login("a@b.com", "secret")
        assertEquals("tok", res.token)
        assertEquals("u1", res.user.id)
        assertEquals(listOf<String?>("tok"), tokens)
        // Guard the exact backend path — auth routes are mounted at /api/auth.
        assertEquals("/api/auth/login", server.takeRequest().path)
        server.shutdown()
    }

    @Test fun register_postsToAuthPath() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"token":"t2","user":{"id":"u2","email":"a@b.com","name":"A"}}"""))
            start()
        }
        val repo = AuthRepository(apiFor(server), saveToken = {})
        repo.register("a@b.com", "secret1", "A")
        assertEquals("/api/auth/register", server.takeRequest().path)
        server.shutdown()
    }
}
