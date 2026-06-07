package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class ChatRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun chats(account: String, limit: Int = 30, offset: Int = 0): List<ChatRow> =
        api.chats(account, limit, offset).chats.map { it.toUi() }
}
