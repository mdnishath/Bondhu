package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun TranslationText(text: String, onSpeak: (() -> Unit)?, speaking: Boolean, modifier: Modifier = Modifier) {
    Column(modifier.padding(top = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Translated", color = Tokens.Primary, fontSize = 10.sp)
            if (onSpeak != null) { Spacer(Modifier.width(6.dp)); Speaker(onSpeak, speaking) }
        }
        Text(text, color = Tokens.TextMut, fontSize = 13.sp)
    }
}
