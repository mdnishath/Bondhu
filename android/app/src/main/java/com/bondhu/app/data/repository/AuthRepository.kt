package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.AuthRequest
import com.bondhu.app.data.model.AuthResponse
import com.bondhu.app.data.store.Prefs
import javax.inject.Inject

class AuthRepository(
    private val api: BondhuApi,
    private val saveToken: suspend (String) -> Unit,
) {
    @Inject constructor(api: BondhuApi, prefs: Prefs) : this(api, { prefs.setJwt(it) })

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
}
