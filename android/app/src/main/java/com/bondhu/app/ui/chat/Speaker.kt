package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun Speaker(onClick: () -> Unit, speaking: Boolean) {
    IconButton(onClick = onClick, modifier = Modifier.size(22.dp)) {
        Icon(Icons.AutoMirrored.Filled.VolumeUp, "Play translation",
            tint = if (speaking) Tokens.Primary else Tokens.TextMut, modifier = Modifier.size(16.dp))
    }
}
