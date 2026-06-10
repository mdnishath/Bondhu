package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.AuthRequest
import com.bondhu.app.data.model.AuthResponse
import com.bondhu.app.data.store.Prefs
import javax.inject.Inject

class AuthRepository(
    private val api: BondhuApi,
    private val saveToken: suspend (String) -> Unit,
    private val clearLocal: suspend () -> Unit = {},
) {
    @Inject constructor(api: BondhuApi, prefs: Prefs) : this(
        api,
        saveToken = { prefs.setJwt(it) },
        clearLocal = { prefs.setJwt(null); prefs.setActiveAccount(null) },
    )

    suspend fun login(email: String, password: String): AuthResponse {
        val res = api.login(AuthRequest(email.trim(), password))
        saveToken(res.token)
        return res
    }

    suspend fun register(email: String, password: String, name: String): AuthResponse {
        val res = api.register(AuthRequest(email.trim(), password, name.trim()))
        saveToken(res.token)
        return res
    }

    /** Revokes the token server-side (best-effort) then clears local state. The
     *  OkHttp AuthInterceptor injects the Bearer token automatically, so the
     *  logout request carries it. Local clear runs regardless of network outcome. */
    suspend fun logout() {
        try { api.logout() } catch (_: Exception) { /* best-effort revoke; clear locally regardless */ }
        clearLocal()
    }
}
