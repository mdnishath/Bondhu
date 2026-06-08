package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, title: String, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val playback by vm.playback.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    var menuExpanded by remember { mutableStateOf(false) }
    LaunchedEffect(chatId) { vm.bind(chatId) }
    LaunchedEffect(s.messages.size) { if (s.messages.isNotEmpty()) listState.animateScrollToItem(s.messages.lastIndex) }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RemoteAvatar(name = title, url = vm.headerAvatarUrl(), size = 36)
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = title,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = Tokens.TextMain,
                            )
                        }
                    },
                    actions = {
                        IconButton(onClick = { menuExpanded = true }) {
                            Icon(Icons.Filled.MoreVert, contentDescription = "More options", tint = Tokens.TextMain)
                        }
                        DropdownMenu(
                            expanded = menuExpanded,
                            onDismissRequest = { menuExpanded = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Chat language") },
                                onClick = { menuExpanded = false; vm.openLangSheet() },
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Tokens.Header,
                        titleContentColor = Tokens.TextMain,
                        navigationIconContentColor = Tokens.TextMain,
                    ),
                )
                HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            }
        },
        bottomBar = {
            Composer(
                draft = s.draft,
                sending = s.sending,
                onDraft = vm::onDraft,
                onSend = vm::send,
                sendMode = s.sendMode,
                outLang = s.outLang,
                supported = s.supported,
                onSetMode = vm::setSendMode,
                onSetOutLang = vm::setOutLang,
                recording = s.recording,
                recordSecs = s.recordSecs,
                onStartRecord = { nowMs -> vm.startRecording(nowMs) },
                onStopRecord = vm::stopRecordingAndTranscribe,
                onCancelRecord = vm::cancelRecording,
                onTick = vm::tickRecording,
                onOpenLangs = { vm.ensureLanguages() },
            )
        },
    ) { pad ->
        if (s.loading) {
            Box(Modifier.fillMaxSize().padding(pad), Alignment.Center) {
                CircularProgressIndicator(color = Tokens.Primary)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().padding(pad),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(s.messages, key = { it.id }) { msg ->
                    val speaking = playback.id == "tts-${msg.id}" && playback.isPlaying
                    val isVoiceActive = playback.id == "voice-${msg.id}"
                    val isVoicePlaying = isVoiceActive && playback.isPlaying
                    val voiceProgress = if (isVoiceActive && playback.durationMs > 0)
                        playback.positionMs.toFloat() / playback.durationMs else 0f
                    val positionMs = if (isVoiceActive) playback.positionMs else 0L
                    val durationMs = if (isVoiceActive) playback.durationMs else 0L
                    val isTranscribing = msg.id in s.retranscribing
                    MessageBubble(
                        m = msg,
                        speaking = speaking,
                        onSpeak = { vm.speak(msg) },
                        isVoicePlaying = isVoicePlaying,
                        voiceProgress = voiceProgress,
                        positionMs = positionMs,
                        durationMs = durationMs,
                        onPlayVoice = { vm.playVoice(msg) },
                        onRetranscribe = { vm.retranscribe(msg) },
                        transcribing = isTranscribing,
                    )
                }
            }
        }
    }

    LanguageSheet(
        open = s.langSheetOpen,
        current = s.chatLang,
        options = s.supported,
        onPick = { vm.setChatLanguage(it) },
        onDismiss = { vm.closeLangSheet() },
    )
}
