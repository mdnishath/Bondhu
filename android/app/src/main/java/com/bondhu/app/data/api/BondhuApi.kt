package com.bondhu.app.data.api

import com.bondhu.app.data.model.*
import retrofit2.http.*

interface BondhuApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: AuthRequest): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: AuthRequest): AuthResponse

    @GET("api/auth/me")
    suspend fun me(): UserDto

    @GET("api/accounts")
    suspend fun accounts(): AccountsResponse

    @POST("api/accounts")
    suspend fun createAccount(@Body body: CreateAccountRequest): CreateAccountResponse

    @POST("api/accounts/{id}/pair")
    suspend fun pair(@Path("id") id: String, @Body body: PairRequest): OkResponse

    @DELETE("api/accounts/{id}")
    suspend fun removeAccount(@Path("id") id: String): OkResponse

    @GET("api/status")
    suspend fun status(@Query("account") account: String): StatusResponse

    @GET("api/chats")
    suspend fun chats(
        @Query("account") account: String,
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0,
    ): ChatsResponse

    @GET("api/messages/{chatId}")
    suspend fun messages(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
        @Query("limit") limit: Int = 50,
        @Query("before") before: Long? = null,
    ): MessagesResponse

    @POST("api/send")
    suspend fun send(@Body body: SendRequest): SendResponse

    @POST("api/chats/{chatId}/mark-read")
    suspend fun markRead(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
    ): OkResponse
}
