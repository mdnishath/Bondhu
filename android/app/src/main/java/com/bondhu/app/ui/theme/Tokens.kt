package com.bondhu.app.ui.theme

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** The full Bondhu colour palette. Two instances exist (dark + light); the active
 *  one lives in [Tokens.palette] (a reactive state), so flipping it recomposes the
 *  whole UI — and every `Tokens.X` call site stays unchanged. */
data class BondhuColors(
    val Primary: Color,
    val PrimaryDk: Color,
    val OnPrimary: Color,
    val AppBg: Color,
    val Surface: Color,
    val Header: Color,
    val InBubble: Color,
    val OutBubble: Color,
    val TextMain: Color,
    val TextMut: Color,
    val TextFaint: Color,
    val Divider: Color,
    val Tick: Color,
    val Field: Color,
    val Danger: Color,
    val Online: Color,
)

val DarkColors = BondhuColors(
    Primary   = Color(0xFFA3E635), // lime-green accent
    PrimaryDk = Color(0xFF84CC16),
    OnPrimary = Color(0xFF0B1207), // near-black text on lime
    AppBg     = Color(0xFF0A0C0B),
    Surface   = Color(0xFF14181A),
    Header    = Color(0xFF161B1D),
    InBubble  = Color(0xFF181D1F),
    OutBubble = Color(0xFF2A3A1E),
    TextMain  = Color(0xFFF1F4EF),
    TextMut   = Color(0xFF93A08F),
    TextFaint = Color(0xFF5E6A5C),
    Divider   = Color(0x14FFFFFF),
    Tick      = Color(0xFFA3E635),
    Field     = Color(0xFF1C2123),
    Danger    = Color(0xFFFF6B6B),
    Online    = Color(0xFF38EC48),
)

val LightColors = BondhuColors(
    Primary   = Color(0xFF7CB518), // a touch deeper lime so it reads on white
    PrimaryDk = Color(0xFF5E8C12),
    OnPrimary = Color(0xFF0B1207),
    AppBg     = Color(0xFFF3F6EE),
    Surface   = Color(0xFFFFFFFF),
    Header    = Color(0xFFFBFCF8),
    InBubble  = Color(0xFFFFFFFF),
    OutBubble = Color(0xFFDCF3BE), // light lime-tinted own bubble
    TextMain  = Color(0xFF15211A),
    TextMut   = Color(0xFF5C6B57),
    TextFaint = Color(0xFF8A968A),
    Divider   = Color(0x14000000),
    Tick      = Color(0xFF5E8C12),
    Field     = Color(0xFFEDF1E8),
    Danger    = Color(0xFFD32F2F),
    Online    = Color(0xFF25B33A),
)

object Tokens {
    /** Active palette — set by BondhuTheme. Reading any `Tokens.X` in a composable
     *  subscribes to this, so a theme switch live-recomposes the app. */
    var palette by mutableStateOf(DarkColors)

    val Primary get() = palette.Primary
    val PrimaryDk get() = palette.PrimaryDk
    val OnPrimary get() = palette.OnPrimary
    val AppBg get() = palette.AppBg
    val Surface get() = palette.Surface
    val Header get() = palette.Header
    val InBubble get() = palette.InBubble
    val OutBubble get() = palette.OutBubble
    val TextMain get() = palette.TextMain
    val TextMut get() = palette.TextMut
    val TextFaint get() = palette.TextFaint
    val Divider get() = palette.Divider
    val Tick get() = palette.Tick
    val Field get() = palette.Field
    val Danger get() = palette.Danger
    val Online get() = palette.Online
}

/** Canonical corner-radius scale — replaces scattered magic dp values. */
object Radii {
    val xs = 8.dp    // chips, small tags
    val sm = 12.dp   // fields, search, small surfaces
    val md = 16.dp   // cards, sheets, list rows
    val lg = 20.dp   // dialogs, hero cards, bubbles
    val pill = 50    // pills / FABs (Int for RoundedCornerShape(50))
}
