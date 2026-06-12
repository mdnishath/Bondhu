package com.bondhu.app.data.api

import com.bondhu.app.data.model.*
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Heavy/slow endpoints — multi-MB base64 uploads and server-side ffmpeg+Gemini
 * work. These run on a client with generous timeouts; the default client's
 * 30s callTimeout aborted long voice-clip transcriptions mid-flight.
 */
interface BondhuMediaApi {
    @POST("api/transcribe")
    suspend fun transcribe(@Body body: TranscribeRequest): TranscribeResponse

    @POST("api/retranscribe")
    suspend fun retranscribe(@Body body: RetranscribeRequest): TranscribeResponse

    @POST("api/send-image")
    suspend fun sendImage(@Body body: SendImageRequest): SendResponse

    @POST("api/send-document")
    suspend fun sendDocument(@Body body: SendDocumentRequest): SendResponse

    @POST("api/send-voice")
    suspend fun sendVoice(@Body body: SendVoiceRequest): SendVoiceResponse
}
