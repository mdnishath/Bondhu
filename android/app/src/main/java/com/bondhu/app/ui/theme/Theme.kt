package com.bondhu.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect

@Composable
fun BondhuTheme(darkTheme: Boolean = true, content: @Composable () -> Unit) {
    val colors = if (darkTheme) DarkColors else LightColors
    // Drive the app-wide Tokens palette; reading any Tokens.* in a composable
    // subscribes to it, so flipping the theme live-recomposes everything.
    SideEffect { Tokens.palette = colors }
    MaterialTheme(
        colorScheme = bondhuColorScheme(colors, darkTheme),
        typography = BondhuTypography,
        content = content,
    )
}
