package com.bondhu.app.ui.nav

object Routes {
    const val SPLASH = "splash"
    const val AUTH = "auth"
    const val ACCOUNTS = "accounts"
    const val PAIR = "pair/{accountId}"
    const val CHAT_LIST = "chatlist"
    const val CHAT = "chat/{chatId}?name={name}"

    fun pair(accountId: String) = "pair/$accountId"
    fun chat(chatId: String, name: String = "") =
        "chat/${android.net.Uri.encode(chatId)}?name=${android.net.Uri.encode(name)}"
}
