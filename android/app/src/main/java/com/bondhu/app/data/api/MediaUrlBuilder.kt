package com.bondhu.app.data.api

import com.bondhu.app.data.store.Prefs
import javax.inject.Inject
import javax.inject.Singleton

/** Builds absolute, token-authenticated URLs for /media and /profile-pic, which
 *  authenticate via a `?token=<jwt>` query param (not a header). Returns null if
 *  the user/account isn't ready. */
@Singleton
class MediaUrlBuilder(
    private val baseUrlProvider: () -> String,
    private val tokenProvider: () -> String?,
    private val accountProvider: () -> String?,
) {
    @Inject constructor(prefs: Prefs) : this(
        baseUrlProvider = { prefs.baseUrlBlocking().trimEnd('/') },
        tokenProvider = { prefs.jwtBlocking() },
        accountProvider = { prefs.activeAccountBlocking() },
    )

    private fun enc(s: String): String = java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    fun media(msgId: String): String? {
        val token = tokenProvider() ?: return null
        val account = accountProvider() ?: return null
        return "${baseUrlProvider()}/api/media/${enc(msgId)}?account=${enc(account)}&token=${enc(token)}"
    }

    fun profilePic(jid: String): String? {
        val token = tokenProvider() ?: return null
        val account = accountProvider() ?: return null
        return "${baseUrlProvider()}/api/profile-pic?account=${enc(account)}&id=${enc(jid)}&token=${enc(token)}"
    }
}
