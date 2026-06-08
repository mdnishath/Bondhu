package com.bondhu.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.AckTick
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ts is epoch millis (backend normalises all timestamps to ms).
private fun hhmm(ts: Long) = if (ts <= 0) "" else SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))

// Own message: tight corner on bottom-end (tail on right).
// Received: tight corner on bottom-start (tail on left).
private val OutBubbleShape = RoundedCornerShape(
    topStart = 20.dp, topEnd = 20.dp, bottomEnd = 6.dp, bottomStart = 20.dp,
)
private val InBubbleShape = RoundedCornerShape(
    topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp,
)

@Composable
fun MessageBubble(
    m: Message,
    speaking: Boolean = false,
    onSpeak: () -> Unit = {},
    isVoicePlaying: Boolean = false,
    voiceProgress: Float = 0f,
    positionMs: Long = 0,
    durationMs: Long = 0,
    onPlayVoice: () -> Unit = {},
    onRetranscribe: () -> Unit = {},
    transcribing: Boolean = false,
    imageUrl: String? = null,
    onOpenImage: () -> Unit = {},
) {
    val align = if (m.fromMe) Alignment.End else Alignment.Start
    val bg = if (m.fromMe) Tokens.OutBubble else Tokens.InBubble
    val shape = if (m.fromMe) OutBubbleShape else InBubbleShape

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalAlignment = align,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(shape)
                .background(bg)
                .padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            if (!m.fromMe && m.senderName != null) {
                Text(m.senderName, color = Tokens.Primary, fontSize = 12.sp)
            }
            if (m.type == "ptt" || m.type == "audio") {
                VoiceBubble(
                    m = m,
                    isPlaying = isVoicePlaying,
                    progress = voiceProgress,
                    positionMs = positionMs,
                    durationMs = durationMs,
                    onPlayToggle = onPlayVoice,
                    onSpeak = onSpeak,
                    speaking = speaking,
                    onRetranscribe = onRetranscribe,
                    transcribing = transcribing,
                )
            } else if (m.type == "image") {
                ImageBubble(m = m, imageUrl = imageUrl, onOpen = onOpenImage)
            } else {
                Text(m.body ?: (if (m.type != "text") "[${m.type}]" else ""), color = Tokens.TextMain)
                if (!m.fromMe && m.translated != null && m.type == "text") {
                    TranslationText(m.translated, onSpeak = onSpeak, speaking = speaking)
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.align(Alignment.End),
            ) {
                Text(hhmm(m.timestamp), color = Tokens.TextFaint, fontSize = 10.sp)
                if (m.fromMe) {
                    Spacer(Modifier.width(4.dp))
                    when (m.ack) {
                        AckTick.NONE, AckTick.SENT ->
                            Icon(Icons.Default.Done, null, tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                        AckTick.DELIVERED ->
                            Icon(Icons.Default.DoneAll, null, tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                        AckTick.READ ->
                            Icon(Icons.Default.DoneAll, null, tint = Tokens.Tick, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}
