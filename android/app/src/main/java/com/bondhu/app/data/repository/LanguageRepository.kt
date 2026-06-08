package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.LanguageResponse
import com.bondhu.app.data.model.SetChatLanguageRequest
import com.bondhu.app.data.model.SetLanguageRequest
import javax.inject.Inject

class LanguageRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun getGlobal(): LanguageResponse = api.getLanguage()
    suspend fun setGlobal(lang: String) { api.setLanguage(SetLanguageRequest(lang)) }
    suspend fun getChat(account: String, chatId: String): String? = api.getChatLanguage(chatId, account).lang
    suspend fun setChat(account: String, chatId: String, lang: String?) { api.setChatLanguage(chatId, account, SetChatLanguageRequest(lang)) }
}
