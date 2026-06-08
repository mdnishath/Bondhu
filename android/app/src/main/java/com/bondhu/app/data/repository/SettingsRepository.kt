package com.bondhu.app.data.repository

import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.model.AddKeyRequest
import com.bondhu.app.data.model.ApiKeyDto
import javax.inject.Inject

class SettingsRepository @Inject constructor(private val api: BondhuApi) {
    suspend fun getKeys(): List<ApiKeyDto> = api.getKeys().keys
    suspend fun addKey(value: String, label: String? = null): ApiKeyDto = api.addKey(AddKeyRequest(value, label))
    suspend fun deleteKey(id: String) { api.deleteKey(id) }
    suspend fun activateKey(id: String) { api.activateKey(id) }
    suspend fun testKey() = api.testKey()
}
