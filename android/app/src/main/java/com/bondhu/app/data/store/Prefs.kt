package com.bondhu.app.data.store

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
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
        val ONBOARDED = booleanPreferencesKey("onboarded")
    }

    val jwt: Flow<String?> = ds.data.map { it[Keys.JWT] }
    val activeAccount: Flow<String?> = ds.data.map { it[Keys.ACTIVE_ACCOUNT] }
    // Server URL is hardcoded (BuildConfig.BASE_URL) and not user-configurable.
    // Always emit it, ignoring any value persisted by older builds.
    val baseUrl: Flow<String> = ds.data.map { BuildConfig.BASE_URL }

    // In-memory cache so the OkHttp interceptors NEVER block on DataStore per
    // request (runBlocking on the OkHttp threads was a hang/contention source).
    // Seeded once at construction; kept fresh by every setter below.
    @Volatile private var cJwt: String? = runBlocking { jwt.first() }
    @Volatile private var cAccount: String? = runBlocking { activeAccount.first() }

    suspend fun setJwt(v: String?) { cJwt = v; ds.edit { p -> if (v == null) p.remove(Keys.JWT) else p[Keys.JWT] = v } }
    suspend fun setActiveAccount(v: String?) { cAccount = v; ds.edit { p -> if (v == null) p.remove(Keys.ACTIVE_ACCOUNT) else p[Keys.ACTIVE_ACCOUNT] = v } }

    // Non-blocking reads for OkHttp interceptors (return the cached value).
    fun jwtBlocking(): String? = cJwt
    fun baseUrlBlocking(): String = BuildConfig.BASE_URL
    fun activeAccountBlocking(): String? = cAccount

    // Theme: "system" | "light" | "dark"
    @Volatile private var cTheme: String = runBlocking { ds.data.first()[Keys.THEME] } ?: "system"
    val theme: Flow<String> = ds.data.map { it[Keys.THEME] ?: "system" }
    fun themeBlocking(): String = cTheme
    suspend fun setTheme(v: String) { cTheme = v; ds.edit { it[Keys.THEME] = v } }

    // First-launch onboarding seen flag.
    @Volatile private var cOnboarded: Boolean = runBlocking { ds.data.first()[Keys.ONBOARDED] } ?: false
    fun onboardedBlocking(): Boolean = cOnboarded
    suspend fun setOnboarded() { cOnboarded = true; ds.edit { it[Keys.ONBOARDED] = true } }

    // per-chat composer prefs
    fun outLangKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("out_lang_${jid}")
    fun sendModeKey(jid: String) = androidx.datastore.preferences.core.stringPreferencesKey("send_mode_${jid}")

    suspend fun setOutLang(jid: String, lang: String?) = ds.edit { p -> val k = outLangKey(jid); if (lang == null) p.remove(k) else p[k] = lang }
    suspend fun setSendMode(jid: String, mode: String) = ds.edit { it[sendModeKey(jid)] = mode } // "text" | "voice"

    // Suspend reads (NOT runBlocking) so the chat-open path never blocks the main thread.
    suspend fun getOutLang(jid: String): String? = ds.data.first()[outLangKey(jid)]
    suspend fun getSendMode(jid: String): String = ds.data.first()[sendModeKey(jid)] ?: "text"
}
