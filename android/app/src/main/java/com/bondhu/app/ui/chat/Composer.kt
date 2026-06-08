package com.bondhu.app.ui.chat

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.ui.theme.Tokens
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Composer(
    draft: String,
    sending: Boolean,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    sendMode: String = "text",
    outLang: String? = null,
    supported: List<LangOption> = emptyList(),
    onSetMode: (String) -> Unit = {},
    onSetOutLang: (String?) -> Unit = {},
    recording: Boolean = false,
    recordSecs: Int = 0,
    onStartRecord: (Long) -> Unit = {},
    onStopRecord: () -> Unit = {},
    onCancelRecord: () -> Unit = {},
    onTick: () -> Unit = {},
    onOpenLangs: () -> Unit = {},
) {
    val context = LocalContext.current
    var showLangSheet by remember { mutableStateOf(false) }

    val selectedLang = supported.firstOrNull { it.code == outLang }
    val isVoiceMode = sendMode == "voice" && outLang != null

    val placeholder = when {
        isVoiceMode -> "Type — sent as ${selectedLang?.name ?: outLang} voice 🔊"
        outLang != null -> "Type — sent in ${selectedLang?.name ?: outLang}"
        else -> "Type a message"
    }

    // Timer tick loop while recording
    LaunchedEffect(recording) {
        if (recording) {
            while (true) {
                delay(1000L)
                onTick()
            }
        }
    }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) onStartRecord(System.currentTimeMillis())
    }

    fun requestMic() {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        if (granted) onStartRecord(System.currentTimeMillis())
        else permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    // Format seconds as M:SS
    fun formatTimer(secs: Int): String {
        val m = secs / 60
        val s = secs % 60
        return "$m:${s.toString().padStart(2, '0')}"
    }

    Surface(color = Tokens.Header) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .imePadding()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Optional hint line (only when outLang != null)
            if (outLang != null) {
                val hintText = if (isVoiceMode)
                    "Sent as ${selectedLang?.name ?: outLang} voice note (+ text)"
                else
                    "Translated to ${selectedLang?.name ?: outLang} before sending"
                Text(
                    text = hintText,
                    color = Tokens.Primary,
                    fontSize = 11.sp,
                )
            }

            // ROW 1 — text input, full width, ON TOP
            OutlinedTextField(
                value = draft,
                onValueChange = onDraft,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(placeholder, color = Tokens.TextMut) },
                maxLines = 5,
                shape = RoundedCornerShape(22.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Tokens.Field,
                    unfocusedContainerColor = Tokens.Field,
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = Tokens.Primary,
                    focusedTextColor = Tokens.TextMain,
                    unfocusedTextColor = Tokens.TextMain,
                ),
            )

            if (recording) {
                // Recording row INSTEAD of ROW 2 when recording
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // Red dot + timer
                    Text(
                        text = "● ${formatTimer(recordSecs)}",
                        color = Color(0xFFE53935),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                    )
                    // Cancel button
                    OutlinedButton(
                        onClick = onCancelRecord,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Tokens.TextMut),
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Cancel", modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Cancel")
                    }
                    // Stop/Send button
                    Button(
                        onClick = onStopRecord,
                        colors = ButtonDefaults.buttonColors(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary),
                    ) {
                        Icon(Icons.Default.Stop, contentDescription = "Stop", modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Send")
                    }
                }
            } else {
                // ROW 2 — actions row, BELOW the input
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // LEFT group: scrollable, contains mode toggle + language chip
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .horizontalScroll(rememberScrollState()),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        // Segmented mode toggle: [Aa] [🎙️]
                        Surface(
                            color = Tokens.Field,
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(3.dp),
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                // "Aa" text mode segment
                                val textSelected = sendMode == "text"
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable { onSetMode("text") }
                                        .background(
                                            if (textSelected) Tokens.Primary.copy(alpha = 0.25f) else Color.Transparent
                                        )
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = "Aa",
                                        color = if (textSelected) Tokens.Primary else Tokens.TextMut,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                                // "🎙️" voice mode segment (disabled when outLang == null)
                                val voiceEnabled = outLang != null
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable(enabled = voiceEnabled) { onSetMode("voice") }
                                        .background(
                                            if (isVoiceMode) Tokens.Primary.copy(alpha = 0.25f) else Color.Transparent
                                        )
                                        .padding(horizontal = 10.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = "🎙️",
                                        color = if (isVoiceMode) Tokens.Primary
                                                else if (voiceEnabled) Tokens.TextMut
                                                else Tokens.TextMut.copy(alpha = 0.4f),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }

                        // Language chip
                        val langLabel = if (selectedLang != null) "${selectedLang.flag} ${selectedLang.name}" else "Language"
                        Surface(
                            color = if (outLang != null) Tokens.Primary.copy(alpha = 0.15f) else Tokens.Field,
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .clickable {
                                        showLangSheet = true
                                        onOpenLangs()
                                    }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Text(
                                    text = "🌐",
                                    fontSize = 12.sp,
                                )
                                Text(
                                    text = langLabel,
                                    color = if (outLang != null) Tokens.Primary else Tokens.TextMut,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.width(8.dp))

                    // Mic button
                    IconButton(
                        onClick = { requestMic() },
                        modifier = Modifier.size(44.dp),
                    ) {
                        Icon(
                            Icons.Default.Mic,
                            contentDescription = "Record",
                            tint = Tokens.Primary,
                            modifier = Modifier.size(26.dp),
                        )
                    }

                    // Send FAB
                    FloatingActionButton(
                        onClick = onSend,
                        containerColor = Tokens.Primary,
                        contentColor = Tokens.OnPrimary,
                        modifier = Modifier.size(48.dp),
                    ) {
                        Icon(Icons.Default.Send, "Send")
                    }
                }
            }
        }
    }

    LanguageSheet(
        open = showLangSheet,
        current = outLang,
        options = supported,
        onPick = { code ->
            onSetOutLang(code)
            // If voice mode selected but lang is cleared, switch back to text
            if (code == null && sendMode == "voice") onSetMode("text")
        },
        onDismiss = { showLangSheet = false },
    )
}
