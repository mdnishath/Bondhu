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

private fun fmt(ms: Long): String {
    val s = (ms / 1000).toInt()
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

@Composable
fun VoiceBubble(
    m: Message,
    isPlaying: Boolean,
    progress: Float,
    positionMs: Long = 0,
    durationMs: Long = 0,
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
        val timeLabel = when {
            durationMs > 0 -> "${fmt(positionMs)} / ${fmt(durationMs)}"
            positionMs > 0 -> fmt(positionMs)
            else -> null
        }
        if (timeLabel != null) {
            Text(timeLabel, color = Tokens.TextMut, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp, bottom = 2.dp))
        }
        if (m.fromMe) {
            // Own sent voice: show transcript as a caption (no label needed)
            if (m.transcript != null) {
                Text(m.transcript, color = Tokens.TextMain, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
            }
        } else {
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
