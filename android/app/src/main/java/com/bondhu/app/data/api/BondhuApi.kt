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

    @POST("api/auth/logout")
    suspend fun logout()

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

    @GET("api/messages/{chatId}/search")
    suspend fun searchMessages(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
        @Query("q") q: String,
    ): MessagesResponse

    @POST("api/send")
    suspend fun send(@Body body: SendRequest): SendResponse

    @POST("api/chats/{chatId}/mark-read")
    suspend fun markRead(
        @Path("chatId") chatId: String,
        @Query("account") account: String,
    ): OkResponse

    @POST("api/tts")
    suspend fun tts(@Body body: TtsRequest): TtsResponse

    @POST("api/transcribe")
    suspend fun transcribe(@Body body: TranscribeRequest): TranscribeResponse

    @POST("api/retranscribe")
    suspend fun retranscribe(@Body body: RetranscribeRequest): TranscribeResponse

    @POST("api/retranslate")
    suspend fun retranslate(@Body body: RetranslateRequest): RetranslateResponse

    @POST("api/send-image")
    suspend fun sendImage(@Body body: SendImageRequest): SendResponse

    @POST("api/send-document")
    suspend fun sendDocument(@Body body: SendDocumentRequest): SendResponse

    @GET("api/app/latest")
    suspend fun latestVersion(): LatestVersionResponse

    @POST("api/send-voice")
    suspend fun sendVoice(@Body body: SendVoiceRequest): SendVoiceResponse

    @GET("api/settings/language")
    suspend fun getLanguage(): LanguageResponse

    @POST("api/settings/language")
    suspend fun setLanguage(@Body body: SetLanguageRequest): OkResponse

    @GET("api/chats/{chatId}/language")
    suspend fun getChatLanguage(@Path("chatId") chatId: String, @Query("account") account: String): ChatLanguageResponse

    @POST("api/chats/{chatId}/language")
    suspend fun setChatLanguage(@Path("chatId") chatId: String, @Query("account") account: String, @Body body: SetChatLanguageRequest): OkResponse

    @GET("api/profile")
    suspend fun profile(@Query("account") account: String, @Query("id") id: String): ProfileResponse

    @GET("api/settings/keys")
    suspend fun getKeys(): KeysResponse

    @POST("api/settings/keys")
    suspend fun addKey(@Body body: AddKeyRequest): ApiKeyDto

    @DELETE("api/settings/keys/{id}")
    suspend fun deleteKey(@Path("id") id: String): OkResponse

    @POST("api/settings/keys/{id}/activate")
    suspend fun activateKey(@Path("id") id: String): OkResponse

    @POST("api/settings/keys/test")
    suspend fun testKey(): TestKeyResponse

    @POST("api/chats/{chatId}/clear")
    suspend fun clearChat(@Path("chatId") chatId: String, @Query("account") account: String): OkResponse

    @POST("api/forward")
    suspend fun forward(@Body body: ForwardRequest): OkResponse

    // --- Message actions ---
    @POST("api/react")
    suspend fun react(@Body body: ReactRequest): OkResponse

    @POST("api/reply")
    suspend fun reply(@Body body: ReplyRequest): SendResponse

    @POST("api/delete-message")
    suspend fun deleteMessage(@Body body: MsgIdRequest): OkResponse

    @POST("api/delete-local")
    suspend fun deleteLocal(@Body body: MsgIdRequest): OkResponse

    @POST("api/edit-message")
    suspend fun editMessage(@Body body: EditMessageRequest): OkResponse

    @POST("api/presence/subscribe")
    suspend fun subscribePresence(@Query("account") account: String, @Body body: JidRequest): OkResponse

    @POST("api/presence/typing")
    suspend fun sendTyping(@Query("account") account: String, @Body body: TypingRequest): OkResponse

    // FCM device-token registration (called once the Firebase SDK provides a token).
    @POST("api/devices/register")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): OkResponse
}
