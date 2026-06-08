package com.bondhu.app.di

import com.bondhu.app.data.api.AuthInterceptor
import com.bondhu.app.data.api.BondhuApi
import com.bondhu.app.data.api.HostSelectionInterceptor
import com.bondhu.app.BuildConfig
import com.squareup.moshi.Moshi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Singleton
    fun moshi(): Moshi = Moshi.Builder().build()

    @Provides @Singleton
    fun okHttp(auth: AuthInterceptor, host: HostSelectionInterceptor): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .callTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(host)
            .addInterceptor(auth)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .build()

    @Provides @Singleton
    fun retrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            // Placeholder host; HostSelectionInterceptor rewrites it at runtime.
            .baseUrl(BuildConfig.BASE_URL.let { if (it.endsWith("/")) it else "$it/" })
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides @Singleton
    fun bondhuApi(retrofit: Retrofit): BondhuApi = retrofit.create(BondhuApi::class.java)
}
