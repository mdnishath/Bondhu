package com.bondhu.app.ui.chat

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.compose.material.icons.automirrored.filled.Reply
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens
import kotlinx.coroutines.delay

private val PillShape = RoundedCornerShape(50)
private val InputShape = RoundedCornerShape(24.dp)

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
    onSendImage: (String, String?, String) -> Unit = { _, _, _ -> },
    replyTo: Message? = null,
    onCancelReply: () -> Unit = {},
    editing: Message? = null,
    onCancelEdit: () -> Unit = {},
) {
    val context = LocalContext.current
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    var showLangSheet by remember { mutableStateOf(false) }
    // Image pending a caption (base64, content-uri) — set by the picker, sent from the dialog.
    var pendingImage by remember { mutableStateOf<Pair<String, String>?>(null) }
    var imageCaption by remember { mutableStateOf("") }

    val selectedLang = supported.firstOrNull { it.code == outLang }
    val isVoiceMode = sendMode == "voice" && outLang != null

    val placeholder = when {
        editing != null -> "Edit message…"
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

    // Image picker launcher
    val imagePicker = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            if (bytes != null) {
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                // Stage the image and let the user add a caption before sending.
                pendingImage = base64 to uri.toString()
                imageCaption = ""
            }
        }
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

    // Outer surface: Header background + top hairline border
    Column {
        HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
        Surface(
            color = Tokens.Header,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Edit banner (above everything when editing an own message)
                if (editing != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Tokens.Field)
                            .padding(start = 10.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.width(3.dp).height(34.dp)
                                .clip(RoundedCornerShape(50)).background(Tokens.Primary),
                        )
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Edit, contentDescription = null,
                                    tint = Tokens.Primary, modifier = Modifier.size(13.dp),
                                )
                                Spacer(Modifier.width(4.dp))
                                Text("Editing message", color = Tokens.Primary, fontSize = 11.sp)
                            }
                            Text(
                                editing.body ?: "",
                                color = Tokens.TextMut, fontSize = 13.sp, maxLines = 1,
                            )
                        }
                        IconButton(onClick = onCancelEdit) {
                            Icon(
                                Icons.Default.Close, contentDescription = "Cancel edit",
                                tint = Tokens.TextMut, modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }

                // Reply quoted bar (above everything when replying)
                if (replyTo != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Tokens.Field)
                            .padding(start = 10.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.width(3.dp).height(34.dp)
                                .clip(RoundedCornerShape(50)).background(Tokens.Primary),
                        )
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.AutoMirrored.Filled.Reply, contentDescription = null,
                                    tint = Tokens.Primary, modifier = Modifier.size(13.dp),
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    if (replyTo.fromMe) "Replying to yourself" else "Reply",
                                    color = Tokens.Primary, fontSize = 11.sp,
                                )
                            }
                            Text(
                                replyTo.body ?: replyTo.transcript ?: "[${replyTo.type}]",
                                color = Tokens.TextMut, fontSize = 13.sp, maxLines = 1,
                            )
                        }
                        IconButton(onClick = onCancelReply) {
                            Icon(
                                Icons.Default.Close, contentDescription = "Cancel reply",
                                tint = Tokens.TextMut, modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }

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
                    shape = InputShape,
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
                            shape = PillShape,
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Tokens.TextMut),
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Cancel", modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Cancel")
                        }
                        // Stop/Send button
                        Button(
                            onClick = onStopRecord,
                            shape = PillShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Tokens.Primary,
                                contentColor = Tokens.OnPrimary,
                            ),
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = "Stop", modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Send")
                        }
                    }
                } else {
                    // Pulsing "Translating…" / "Sending…" caption while sending
                    if (sending) {
                        val infiniteTransition = rememberInfiniteTransition(label = "sendingPulse")
                        val pulse by infiniteTransition.animateFloat(
                            initialValue = 0.3f,
                            targetValue = 1f,
                            animationSpec = infiniteRepeatable(
                                animation = tween(700),
                                repeatMode = RepeatMode.Reverse,
                            ),
                            label = "sendingDotAlpha",
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(start = 4.dp, bottom = 2.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Tokens.Primary)
                                    .alpha(pulse),
                            )
                            Text(
                                text = if (outLang != null) "Translating…" else "Sending…",
                                color = Tokens.Primary,
                                fontSize = 12.sp,
                                modifier = Modifier.alpha(pulse),
                            )
                        }
                    }

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
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            // Segmented mode toggle: [Aa] [🎙️] — pill container
                            Surface(
                                color = Tokens.Field,
                                shape = PillShape,
                            ) {
                                Row(
                                    modifier = Modifier.padding(3.dp),
                                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                                ) {
                                    // "Aa" text mode segment
                                    val textSelected = sendMode == "text"
                                    Box(
                                        modifier = Modifier
                                            .clip(PillShape)
                                            .clickable { onSetMode("text") }
                                            .background(
                                                if (textSelected) Tokens.Primary.copy(alpha = 0.25f) else Color.Transparent,
                                            )
                                            .padding(horizontal = 12.dp, vertical = 7.dp),
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
                                            .clip(PillShape)
                                            .clickable(enabled = voiceEnabled) { onSetMode("voice") }
                                            .background(
                                                if (isVoiceMode) Tokens.Primary.copy(alpha = 0.25f) else Color.Transparent,
                                            )
                                            .padding(horizontal = 12.dp, vertical = 7.dp),
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

                            // Language chip — pill
                            val langLabel = if (selectedLang != null) "${selectedLang.flag} ${selectedLang.name}" else "Language"
                            Surface(
                                color = if (outLang != null) Tokens.Primary.copy(alpha = 0.15f) else Tokens.Field,
                                shape = PillShape,
                            ) {
                                Row(
                                    modifier = Modifier
                                        .clickable {
                                            showLangSheet = true
                                            onOpenLangs()
                                        }
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
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

                        // RIGHT group: attach + mic + send, tightly spaced
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            // Attach button — opens image picker
                            IconButton(
                                onClick = { imagePicker.launch("image/*") },
                                modifier = Modifier.size(44.dp),
                            ) {
                                Icon(
                                    Icons.Default.AttachFile,
                                    contentDescription = "Attach",
                                    tint = Tokens.TextMut,
                                    modifier = Modifier.size(24.dp),
                                )
                            }

                            // Mic button — ghost, TextMut
                            IconButton(
                                onClick = { requestMic() },
                                modifier = Modifier.size(44.dp),
                            ) {
                                Icon(
                                    Icons.Default.Mic,
                                    contentDescription = "Record",
                                    tint = Tokens.TextMut,
                                    modifier = Modifier.size(26.dp),
                                )
                            }

                            // Send FAB — circular lime, crossfades to spinner while sending
                            FloatingActionButton(
                                onClick = {
                                    if (!sending && draft.isNotBlank()) {
                                        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                                        onSend()
                                    }
                                },
                                containerColor = Tokens.Primary,
                                contentColor = Tokens.OnPrimary,
                                modifier = Modifier.size(48.dp),
                                shape = CircleShape,
                            ) {
                                Crossfade(
                                    targetState = sending,
                                    label = "fabIcon",
                                ) { isSending ->
                                    if (isSending) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(22.dp),
                                            strokeWidth = 2.dp,
                                            color = Tokens.OnPrimary,
                                        )
                                    } else {
                                        Icon(Icons.Default.Send, "Send")
                                    }
                                }
                            }
                        }
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

    // Image caption dialog — preview the picked image and optionally add a caption.
    val pending = pendingImage
    if (pending != null) {
        AlertDialog(
            onDismissRequest = { pendingImage = null; imageCaption = "" },
            containerColor = Tokens.Surface,
            shape = RoundedCornerShape(20.dp),
            title = { Text("Send image", color = Tokens.TextMain, fontWeight = FontWeight.SemiBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    coil.compose.AsyncImage(
                        model = pending.second,
                        contentDescription = "Selected image",
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 240.dp)
                            .clip(RoundedCornerShape(12.dp)),
                    )
                    OutlinedTextField(
                        value = imageCaption,
                        onValueChange = { imageCaption = it },
                        placeholder = { Text("Add a caption…", color = Tokens.TextMut) },
                        maxLines = 3,
                        shape = InputShape,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Tokens.Field,
                            unfocusedContainerColor = Tokens.Field,
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent,
                            cursorColor = Tokens.Primary,
                            focusedTextColor = Tokens.TextMain,
                            unfocusedTextColor = Tokens.TextMain,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onSendImage(pending.first, pending.second, imageCaption.trim())
                        pendingImage = null; imageCaption = ""
                    },
                    shape = PillShape,
                    colors = ButtonDefaults.buttonColors(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary),
                ) { Text("Send") }
            },
            dismissButton = {
                TextButton(onClick = { pendingImage = null; imageCaption = "" }) {
                    Text("Cancel", color = Tokens.TextMut)
                }
            },
        )
    }
}
