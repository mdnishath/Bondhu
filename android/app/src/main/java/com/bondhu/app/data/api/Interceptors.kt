package com.bondhu.app.data.api

import com.bondhu.app.data.store.Prefs
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/** Attaches `Authorization: Bearer <jwt>` when a token exists. */
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    @Inject constructor(prefs: Prefs) : this({ prefs.jwtBlocking() })
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val req = chain.request()
        val out = if (token.isNullOrEmpty()) req
        else req.newBuilder().header("Authorization", "Bearer $token").build()
        return chain.proceed(out)
    }
}

/** Rewrites scheme/host/port to the runtime-configured base URL (Prefs override
 *  or BuildConfig default). Retrofit's static baseUrl is only a placeholder. */
class HostSelectionInterceptor @Inject constructor(private val prefs: Prefs) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val base = prefs.baseUrlBlocking().toHttpUrl()
        val req = chain.request()
        val newUrl = req.url.newBuilder()
            .scheme(base.scheme).host(base.host).port(base.port).build()
        return chain.proceed(req.newBuilder().url(newUrl).build())
    }
}
