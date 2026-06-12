package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.api.BondhuMediaApi
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.ForwardRequest
import com.bondhu.app.data.model.MsgIdRequest
import com.bondhu.app.data.model.ReactRequest
import com.bondhu.app.data.model.ReplyRequest
import com.bondhu.app.data.model.SendImageRequest
import com.bondhu.app.data.model.SendRequest
import com.bondhu.app.data.model.SendResponse
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class ChatRepository @Inject constructor(
    private val api: BondhuApi,
    // Media/AI endpoints (big base64 bodies + server-side ffmpeg/Gemini) go via
    // the long-timeout client — the default 30s callTimeout killed long clips.
    private val mediaApi: BondhuMediaApi,
) {

    suspend fun chats(account: String, limit: Int = 30, offset: Int = 0): List<ChatRow> =
        api.chats(account, limit, offset).chats.map { it.toUi() }

    suspend fun messages(account: String, chatId: String, before: Long? = null, limit: Int = 50): List<Message> =
        // Backend returns newest-first (ORDER BY timestamp DESC); the chat list paints
        // top-to-bottom, so sort ascending (oldest first, newest last) for display.
        api.messages(chatId, account, limit, before).messages.map { it.toUi() }.sortedBy { it.timestamp }

    suspend fun send(account: String, chatId: String, message: String, translateTo: String?): SendResponse =
        api.send(SendRequest(account = account, chatId = chatId, message = message, translateTo = translateTo))

    suspend fun markRead(account: String, chatId: String) {
        api.markRead(chatId, account)
    }

    suspend fun tts(account: String, msgId: String, text: String, lang: String?) =
        api.tts(com.bondhu.app.data.model.TtsRequest(account, msgId, text, lang))
    suspend fun transcribe(account: String, audioBase64: String, mimeType: String) =
        mediaApi.transcribe(com.bondhu.app.data.model.TranscribeRequest(account, audioBase64, mimeType)).transcript
    suspend fun retranscribe(account: String, msgId: String) =
        mediaApi.retranscribe(com.bondhu.app.data.model.RetranscribeRequest(account, msgId)).transcript
    suspend fun retranslate(account: String, chatId: String, msgId: String, text: String) =
        api.retranslate(com.bondhu.app.data.model.RetranslateRequest(account, msgId, text, chatId))
    suspend fun sendVoice(account: String, chatId: String, message: String, translateTo: String?) =
        mediaApi.sendVoice(com.bondhu.app.data.model.SendVoiceRequest(account, chatId, message, translateTo))
    suspend fun sendImage(account: String, chatId: String, imageBase64: String, caption: String?) =
        mediaApi.sendImage(SendImageRequest(account, chatId, imageBase64, caption))

    suspend fun sendDocument(account: String, chatId: String, fileBase64: String, fileName: String, mimeType: String) =
        mediaApi.sendDocument(com.bondhu.app.data.model.SendDocumentRequest(account, chatId, fileBase64, fileName, mimeType))

    suspend fun profile(account: String, id: String) = api.profile(account, id)

    suspend fun react(account: String, msgId: String, emoji: String) =
        api.react(ReactRequest(account, msgId, emoji))

    suspend fun reply(account: String, chatId: String, msgId: String, text: String): SendResponse =
        api.reply(ReplyRequest(account, chatId, msgId, text))

    suspend fun deleteForEveryone(account: String, msgId: String) =
        api.deleteMessage(MsgIdRequest(account, msgId))

    suspend fun deleteForMe(account: String, msgId: String) =
        api.deleteLocal(MsgIdRequest(account, msgId))

    suspend fun clearChat(account: String, chatId: String) =
        api.clearChat(chatId, account)

    suspend fun forward(account: String, msgIds: List<String>, targetChatIds: List<String>) =
        api.forward(ForwardRequest(account, msgIds, targetChatIds))

    suspend fun editMessage(account: String, msgId: String, text: String) =
        api.editMessage(com.bondhu.app.data.model.EditMessageRequest(account, msgId, text))

    suspend fun subscribePresence(account: String, jid: String) =
        api.subscribePresence(account, com.bondhu.app.data.model.JidRequest(jid))

    suspend fun sendTyping(account: String, jid: String, on: Boolean) =
        api.sendTyping(account, com.bondhu.app.data.model.TypingRequest(jid, on))

    /** Backend search across a chat's full history (not just the loaded window). */
    suspend fun searchMessages(account: String, chatId: String, q: String): List<Message> =
        api.searchMessages(chatId, account, q).messages.map { it.toUi() }
}
