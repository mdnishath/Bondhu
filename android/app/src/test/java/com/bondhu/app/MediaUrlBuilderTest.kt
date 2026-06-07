package com.bondhu.app

import com.bondhu.app.data.api.MediaUrlBuilder
import org.junit.Assert.assertEquals
import org.junit.Test

class MediaUrlBuilderTest {
    private val b = MediaUrlBuilder(
        baseUrlProvider = { "https://wa.client-flow.xyz" },
        tokenProvider = { "JWT123" },
        accountProvider = { "account-7" },
    )
    @Test fun media_buildsTokenisedUrl() {
        assertEquals(
            "https://wa.client-flow.xyz/api/media/ABC?account=account-7&token=JWT123",
            b.media("ABC"),
        )
    }
    @Test fun profilePic_encodesJid() {
        assertEquals(
            "https://wa.client-flow.xyz/api/profile-pic?account=account-7&id=12%40lid&token=JWT123",
            b.profilePic("12@lid"),
        )
    }
    @Test fun returnsNull_whenNoAccountOrToken() {
        val nb = MediaUrlBuilder({ "https://x" }, { null }, { "a" })
        assertEquals(null, nb.media("X"))
    }
}
