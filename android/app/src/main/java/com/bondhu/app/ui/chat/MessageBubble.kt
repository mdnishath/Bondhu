package com.bondhu.app.ui.chat

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
private fun fullTime(ts: Long) = if (ts <= 0) "" else SimpleDateFormat("d MMM yyyy, HH:mm", Locale.getDefault()).format(Date(ts))

// Own message: tight corner on bottom-end (tail on right).
// Received: tight corner on bottom-start (tail on left).
private val OutBubbleShape = RoundedCornerShape(
    topStart = 20.dp, topEnd = 20.dp, bottomEnd = 6.dp, bottomStart = 20.dp,
)
private val InBubbleShape = RoundedCornerShape(
    topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp,
)

@OptIn(ExperimentalFoundationApi::class)
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
    voiceSpeed: Float = 1f,
    onCycleSpeed: () -> Unit = {},
    imageUrl: String? = null,
    onOpenImage: () -> Unit = {},
    onLongPress: () -> Unit = {},
    onRetry: () -> Unit = {},
    selected: Boolean = false,
    onTap: (() -> Unit)? = null,
    onDoubleTap: (() -> Unit)? = null,
    onJumpToQuoted: (String) -> Unit = {},
    onDownload: () -> Unit = {},
) {
    val align = if (m.fromMe) Alignment.End else Alignment.Start
    val bg = if (m.fromMe) Tokens.OutBubble else Tokens.InBubble
    val shape = if (m.fromMe) OutBubbleShape else InBubbleShape
    var showFullTime by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (selected) Tokens.Primary.copy(alpha = 0.12f) else androidx.compose.ui.graphics.Color.Transparent)
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalAlignment = align,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(shape)
                .background(bg)
                .combinedClickable(
                    onClick = { if (onTap != null) onTap() else showFullTime = !showFullTime },
                    onLongClick = onLongPress,
                    onDoubleClick = onDoubleTap,
                )
                .padding(horizontal = 12.dp, vertical = 9.dp),
        ) {
            if (!m.fromMe && m.senderName != null) {
                Text(m.senderName, color = Tokens.Primary, fontSize = 12.sp)
            }
            if (!m.quotedText.isNullOrBlank()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 4.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (m.fromMe) androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.18f) else Tokens.Field)
                        .clickable(enabled = m.quotedId != null) { m.quotedId?.let(onJumpToQuoted) },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.width(3.dp).height(30.dp).background(Tokens.Primary))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        m.quotedText,
                        color = Tokens.TextMut,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(vertical = 5.dp, horizontal = 2.dp),
                    )
                }
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
                    speed = voiceSpeed,
                    onCycleSpeed = onCycleSpeed,
                )
            } else if (m.type == "image") {
                ImageBubble(m = m, imageUrl = imageUrl, onOpen = onOpenImage)
            } else if (m.type == "document") {
                DocumentBubble(m = m, onDownload = onDownload)
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
                Text(if (showFullTime) fullTime(m.timestamp) else hhmm(m.timestamp), color = Tokens.TextFaint, fontSize = 10.sp)
                if (m.fromMe) {
                    Spacer(Modifier.width(4.dp))
                    when {
                        m.failed -> Icon(
                            Icons.Default.ErrorOutline, "Failed — tap to retry", tint = Tokens.Danger,
                            modifier = Modifier.size(15.dp).clickable { onRetry() },
                        )
                        m.pending -> Icon(
                            Icons.Default.Schedule, "Sending", tint = Tokens.TextFaint, modifier = Modifier.size(13.dp),
                        )
                        else -> when (m.ack) {
                            AckTick.NONE, AckTick.SENT ->
                                Icon(Icons.Default.Done, "Sent", tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                            AckTick.DELIVERED ->
                                Icon(Icons.Default.DoneAll, "Delivered", tint = Tokens.TextFaint, modifier = Modifier.size(14.dp))
                            AckTick.READ ->
                                Icon(Icons.Default.DoneAll, "Read", tint = Tokens.Tick, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }

        // Reaction badges (below the bubble)
        if (m.reactions.isNotEmpty()) {
            val grouped = m.reactions.groupBy { it.emoji }
            Row(
                modifier = Modifier.padding(top = 3.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                grouped.forEach { (emoji, list) ->
                    Surface(
                        color = Tokens.Field,
                        shape = RoundedCornerShape(50),
                    ) {
                        Text(
                            text = if (list.size > 1) "$emoji ${list.size}" else emoji,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            color = Tokens.TextMain,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentBubble(m: Message, onDownload: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.widthIn(max = 270.dp),
    ) {
        Surface(color = Tokens.Field, shape = RoundedCornerShape(10.dp), modifier = Modifier.size(40.dp)) {
            androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Description, contentDescription = null, tint = Tokens.Primary, modifier = Modifier.size(22.dp))
            }
        }
        Spacer(Modifier.width(10.dp))
        Text(
            m.body ?: "Document",
            color = Tokens.TextMain,
            fontSize = 14.sp,
            maxLines = 2,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (!m.fromMe) {
            IconButton(onClick = onDownload) {
                Icon(Icons.Default.Download, contentDescription = "Download", tint = Tokens.Primary)
            }
        }
    }
}
