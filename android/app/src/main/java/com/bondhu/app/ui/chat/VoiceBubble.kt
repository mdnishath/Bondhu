package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens

@Composable
fun VoiceBubble(
    m: Message,
    isPlaying: Boolean,
    progress: Float,
    onPlayToggle: () -> Unit,
    onSpeak: () -> Unit,
    speaking: Boolean,
    onRetranscribe: () -> Unit,
    transcribing: Boolean = false,
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onPlayToggle) {
                Icon(
                    if (isPlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                    contentDescription = if (isPlaying) "Stop voice" else "Play voice",
                    tint = Tokens.TextMain,
                )
            }
            LinearProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = Modifier
                    .weight(1f)
                    .height(3.dp),
                color = Tokens.Primary,
                trackColor = Tokens.Divider,
            )
            Spacer(Modifier.width(8.dp))
        }
        if (!m.fromMe) {
            if (m.transcript != null) {
                Text(
                    "Transcript",
                    color = Tokens.TextMut,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(m.transcript, color = Tokens.TextMain, fontSize = 13.sp)
                if (m.translated != null) {
                    TranslationText(m.translated, onSpeak = onSpeak, speaking = speaking)
                }
            } else {
                if (transcribing) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(vertical = 4.dp),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = Tokens.Primary,
                        )
                        Text("Transcribing…", color = Tokens.TextMut, fontSize = 12.sp)
                    }
                } else {
                    TextButton(onClick = onRetranscribe) {
                        Text("Transcribe", color = Tokens.Primary)
                    }
                }
            }
        }
    }
}
