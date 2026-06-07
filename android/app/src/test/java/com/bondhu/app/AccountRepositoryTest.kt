package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.repository.AccountRepository
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class AccountRepositoryTest {
    private fun apiFor(server: MockWebServer): BondhuApi =
        Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
            .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
            .build().create(BondhuApi::class.java)

    @Test fun list_mapsAccounts() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"accounts":[{"id":"a1","label":"Personal","phone":"+1","status":"connected","qr":null}]}"""))
            start()
        }
        val repo = AccountRepository(apiFor(server))
        val list = repo.list()
        assertEquals(1, list.size)
        assertEquals("a1", list[0].id)
        assertEquals("Personal", list[0].label)
        server.shutdown()
    }

    @Test fun add_returnsAccountId() = runTest {
        val server = MockWebServer().apply {
            enqueue(MockResponse().setBody("""{"accountId":"a2"}"""))
            start()
        }
        val repo = AccountRepository(apiFor(server))
        assertEquals("a2", repo.add())
        server.shutdown()
    }
}
