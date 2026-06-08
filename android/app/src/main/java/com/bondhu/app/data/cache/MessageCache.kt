package com.bondhu.app.data.cache

import com.bondhu.app.data.model.Message
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-scoped in-memory cache of the messages already loaded for each chat,
 * keyed by chatId. Lets a chat re-open instantly (no spinner) even after its
 * ViewModel was destroyed on back-navigation — the ViewModel seeds its state
 * from here on bind and refreshes in the background. Survives for the app
 * session; cleared per-chat on "Clear chat".
 */
@Singleton
class MessageCache @Inject constructor() {
    private val map = ConcurrentHashMap<String, List<Message>>()

    fun get(chatId: String): List<Message>? = map[chatId]
    fun put(chatId: String, messages: List<Message>) { map[chatId] = messages }
    fun clear(chatId: String) { map.remove(chatId) }
}
