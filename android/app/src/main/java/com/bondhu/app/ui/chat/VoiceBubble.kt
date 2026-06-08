package com.bondhu.app.ui.chat

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
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
    speed: Float = 1f,
    onCycleSpeed: () -> Unit = {},
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Circular lime play/stop button
            FilledIconButton(
                onClick = onPlayToggle,
                modifier = Modifier.size(40.dp),
                shape = CircleShape,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = Tokens.Primary,
                    contentColor = Tokens.OnPrimary,
                ),
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                    contentDescription = if (isPlaying) "Stop voice" else "Play voice",
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            // Stylized waveform: per-message bar shape (deterministic from id),
            // filled up to the playback progress.
            val bars = androidx.compose.runtime.remember(m.id) {
                val rnd = java.util.Random(m.id.hashCode().toLong())
                List(28) { 0.28f + rnd.nextFloat() * 0.72f }
            }
            Row(
                modifier = Modifier.weight(1f).height(26.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                val p = progress.coerceIn(0f, 1f)
                bars.forEachIndexed { i, h ->
                    val filled = i.toFloat() / bars.size <= p
                    Box(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight(h)
                            .clip(RoundedCornerShape(50))
                            .background(if (filled) Tokens.Primary else Tokens.Divider),
                    )
                }
            }
            if (isPlaying) {
                Spacer(Modifier.width(6.dp))
                Surface(
                    color = Tokens.Field,
                    shape = RoundedCornerShape(50),
                    modifier = Modifier.clickable { onCycleSpeed() },
                ) {
                    Text(
                        "${if (speed == 1f) "1" else if (speed == 1.5f) "1.5" else "2"}×",
                        color = Tokens.Primary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }
        val timeLabel = when {
            durationMs > 0 -> "${fmt(positionMs)} / ${fmt(durationMs)}"
            positionMs > 0 -> fmt(positionMs)
            else -> null
        }
        if (timeLabel != null) {
            Text(
                timeLabel,
                color = Tokens.TextMut,
                fontSize = 11.sp,
                modifier = Modifier.padding(start = 48.dp, bottom = 2.dp),
            )
        }
        if (m.fromMe) {
            // Own sent voice: show transcript as a caption (no label needed)
            if (m.transcript != null) {
                Text(
                    m.transcript,
                    color = Tokens.TextMain,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
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
                    val infiniteTransition = rememberInfiniteTransition(label = "transcribingPulse")
                    val pulse by infiniteTransition.animateFloat(
                        initialValue = 0.4f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(700),
                            repeatMode = RepeatMode.Reverse,
                        ),
                        label = "transcribingTextAlpha",
                    )
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
                        Text(
                            "Transcribing…",
                            color = Tokens.TextMut,
                            fontSize = 12.sp,
                            modifier = Modifier.alpha(pulse),
                        )
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
