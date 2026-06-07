package com.bondhu.app.ui.common

import androidx.compose.ui.graphics.Color

val AVATAR_COLORS = listOf(
    Color(0xFF6B8AFE), Color(0xFFE59866), Color(0xFF48C9B0), Color(0xFFEC7063),
    Color(0xFFAF7AC5), Color(0xFF5DADE2), Color(0xFFF4D03F), Color(0xFF52BE80), Color(0xFFE08283),
)

fun avColorIndex(seed: String?): Int {
    val s = seed ?: ""
    var sum = 0
    for (c in s) sum += c.code
    return if (s.isEmpty()) 0 else sum % AVATAR_COLORS.size
}

fun avColor(seed: String?): Color = AVATAR_COLORS[avColorIndex(seed)]

fun initials(name: String?): String {
    val parts = (name ?: "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.isEmpty()) return "?"
    val first = parts[0].firstOrNull()?.uppercaseChar() ?: return "?"
    if (parts.size == 1) return first.toString()
    val second = parts[1].firstOrNull()?.uppercaseChar()
    return if (second != null) "$first$second" else first.toString()
}
