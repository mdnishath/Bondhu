package com.bondhu.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

@Composable
fun BondhuTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BondhuColorScheme,
        typography = BondhuTypography,
        content = content,
    )
}
