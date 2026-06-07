package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.Message
import com.bondhu.app.data.model.SendRequest
import com.bondhu.app.data.model.SendResponse
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class ChatRepository @Inject constructor(private val api: BondhuApi) {

    suspend fun chats(account: String, limit: Int = 30, offset: Int = 0): List<ChatRow> =
        api.chats(account, limit, offset).chats.map { it.toUi() }

    suspend fun messages(account: String, chatId: String, before: Long? = null, limit: Int = 50): List<Message> =
        api.messages(chatId, account, limit, before).messages.map { it.toUi() }

    suspend fun send(account: String, chatId: String, message: String, translateTo: String?): SendResponse =
        api.send(SendRequest(account = account, chatId = chatId, message = message, translateTo = translateTo))

    suspend fun markRead(account: String, chatId: String) {
        api.markRead(chatId, account)
    }
}
