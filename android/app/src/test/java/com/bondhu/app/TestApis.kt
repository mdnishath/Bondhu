package com.bondhu.app

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.api.BondhuMediaApi
import com.bondhu.app.data.repository.ChatRepository
import com.squareup.moshi.Moshi
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockWebServer
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

/** ChatRepository wired to a MockWebServer — both the normal and the
 *  long-timeout media API point at the same server in tests. */
fun chatRepoFor(server: MockWebServer): ChatRepository {
    val retrofit = Retrofit.Builder().baseUrl(server.url("/")).client(OkHttpClient())
        .addConverterFactory(MoshiConverterFactory.create(Moshi.Builder().build()))
        .build()
    return ChatRepository(retrofit.create(BondhuApi::class.java), retrofit.create(BondhuMediaApi::class.java))
}
