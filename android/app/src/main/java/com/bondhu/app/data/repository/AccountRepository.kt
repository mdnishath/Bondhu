package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.Account
import com.bondhu.app.data.model.CreateAccountRequest
import com.bondhu.app.data.model.PairRequest
import com.bondhu.app.data.model.StatusResponse
import com.bondhu.app.data.model.toUi
import javax.inject.Inject

class AccountRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun list(): List<Account> = api.accounts().accounts.map { it.toUi() }
    suspend fun add(label: String? = null): String = api.createAccount(CreateAccountRequest(label)).accountId
    suspend fun pair(accountId: String, phone: String) { api.pair(accountId, PairRequest(phone)) }
    suspend fun remove(accountId: String) { api.removeAccount(accountId) }
    suspend fun status(accountId: String): StatusResponse = api.status(accountId)
}
