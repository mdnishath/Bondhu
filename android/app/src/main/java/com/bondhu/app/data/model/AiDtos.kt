package com.bondhu.app.data.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true) data class TtsRequest(val account: String, val msgId: String, val text: String, val lang: String? = null)
@JsonClass(generateAdapter = true) data class TtsResponse(val audioBase64: String, val mime: String)

@JsonClass(generateAdapter = true) data class TranscribeRequest(val account: String, val audioBase64: String, val mimeType: String)
@JsonClass(generateAdapter = true) data class TranscribeResponse(val transcript: String?)

@JsonClass(generateAdapter = true) data class RetranscribeRequest(val account: String, val msgId: String)

@JsonClass(generateAdapter = true) data class RetranslateRequest(val account: String, val msgId: String, val text: String, val chatId: String)
@JsonClass(generateAdapter = true) data class RetranslateResponse(val translated: String?, val lang: String?)

@JsonClass(generateAdapter = true) data class SendVoiceRequest(val account: String, val chatId: String, val message: String, val translateTo: String? = null)
@JsonClass(generateAdapter = true) data class SendVoiceResponse(
    val success: Boolean = true,
    val voiceMsgId: String? = null,
    val textMsgId: String? = null,
    val sentText: String? = null,
    val original: String? = null,
    val audioBase64: String? = null,
    val mime: String? = null,
)

@JsonClass(generateAdapter = true) data class LangOption(val code: String, val name: String, val flag: String)
@JsonClass(generateAdapter = true) data class LanguageResponse(val lang: String, val supported: List<LangOption>)
@JsonClass(generateAdapter = true) data class SetLanguageRequest(val lang: String)
@JsonClass(generateAdapter = true) data class ChatLanguageResponse(val lang: String? = null)
@JsonClass(generateAdapter = true) data class SetChatLanguageRequest(val lang: String?)
@JsonClass(generateAdapter = true) data class ProfileResponse(val jid: String, val about: String? = null, val phoneJid: String? = null, val phone: String? = null)
