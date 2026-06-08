package com.bondhu.app.data.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.bondhu.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "bondhu")

@Singleton
class Prefs @Inject constructor(@ApplicationContext private val context: Context) {
    private val ds = context.dataStore

    private object Keys {
        val JWT = stringPreferencesKey("jwt")
        val ACTIVE_ACCOUNT = stringPreferencesKey("active_account")
        val BASE_URL = stringPreferencesKey("base_url")
        val THEME = stringPreferencesKey("theme")
    }

    val jwt: Flow<String?> = ds.data.map { it[Keys.JWT] }
    val activeAccount: Flow<String?> = ds.data.map { it[Keys.ACTIVE_ACCOUNT] }
    // Server URL is hardcoded (BuildConfig.BASE_URL) and not user-configurable.
    // Always emit it, ignoring any value persisted by older builds.
    val baseUrl: Flow<String> = ds.data.map { BuildConfig.BASE_URL }

    suspend fun setJwt(v: String?) = ds.edit { p -> if (v == null) p.remove(Keys.JWT) else p[Keys.JWT] = v }
    suspend fun setActiveAccount(v: String?) = ds.edit { p -> if (v == null) p.remove(Keys.ACTIVE_ACCOUNT) else p[Keys.ACTIVE_ACCOUNT] = v }

    // Blocking reads for OkHttp interceptors (called off the main thread).
    fun jwtBlocking(): String? = runBlocking { jwt.first() }
    fun baseUrlBlocking(): String = runBlocking { baseUrl.first() }
    fun activeAccountBlocking(): String? = runBlocking { activeAccount.first() }

    // per-chat composer prefs
    fun outLangKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("out_lang_${jid}")
    fun sendModeKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("send_mode_${jid}")

    suspend fun setOutLang(jid: String, lang: String?) = ds.edit { p -> val k = outLangKey(jid); if (lang == null) p.remove(k) else p[k] = lang }
    fun outLangBlocking(jid: String): String? = runBlocking { ds.data.first()[outLangKey(jid)] }
    suspend fun setSendMode(jid: String, mode: String) = ds.edit { it[sendModeKey(jid)] = mode } // "text" | "voice"
    fun sendModeBlocking(jid: String): String = runBlocking { ds.data.first()[sendModeKey(jid)] ?: "text" }
}
