package com.bondhu.app.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme

/** Build an M3 ColorScheme from a Bondhu palette (most of the app uses Tokens.* directly,
 *  but Material components read MaterialTheme.colorScheme — keep them in sync). */
fun bondhuColorScheme(c: BondhuColors, dark: Boolean): ColorScheme {
    val base = if (dark)
        darkColorScheme(
            primary = c.Primary, onPrimary = c.OnPrimary, secondary = c.PrimaryDk, tertiary = c.Online,
            background = c.AppBg, onBackground = c.TextMain, surface = c.Surface, onSurface = c.TextMain,
            surfaceVariant = c.Header, onSurfaceVariant = c.TextMut, error = c.Danger, outline = c.TextFaint,
        )
    else
        lightColorScheme(
            primary = c.Primary, onPrimary = c.OnPrimary, secondary = c.PrimaryDk, tertiary = c.Online,
            background = c.AppBg, onBackground = c.TextMain, surface = c.Surface, onSurface = c.TextMain,
            surfaceVariant = c.Header, onSurfaceVariant = c.TextMut, error = c.Danger, outline = c.TextFaint,
        )
    return base
}
