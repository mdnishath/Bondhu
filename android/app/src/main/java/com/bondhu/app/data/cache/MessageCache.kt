package com.bondhu.app.data.cache

import com.bondhu.app.data.model.Message
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-scoped in-memory cache of the messages already loaded for each chat,
 * keyed by (account, chatId). Lets a chat re-open instantly (no spinner) even
 * after its ViewModel was destroyed on back-navigation — the ViewModel seeds
 * its state from here on bind and refreshes in the background. Survives for the
 * app session; cleared per-chat on "Clear chat".
 *
 * The key MUST include the account: two linked WhatsApp accounts commonly share
 * the same chat jid (same contact / @lid), so a chatId-only key let a chat
 * opened after an account switch flash the OTHER account's messages.
 */
@Singleton
class MessageCache @Inject constructor() {
    private val map = ConcurrentHashMap<String, List<Message>>()

    // '#' appears in neither an account id ("account-<uuid>") nor a jid, so it's a safe separator.
    private fun key(account: String, chatId: String) = "$account#$chatId"

    fun get(account: String, chatId: String): List<Message>? = map[key(account, chatId)]
    fun put(account: String, chatId: String, messages: List<Message>) { map[key(account, chatId)] = messages }
    fun clear(account: String, chatId: String) { map.remove(key(account, chatId)) }
}
