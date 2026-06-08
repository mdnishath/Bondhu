package com.bondhu.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.bondhu.app.data.model.Message
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, title: String, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val playback by vm.playback.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    var menuExpanded by remember { mutableStateOf(false) }
    var lightboxUrl by remember { mutableStateOf<String?>(null) }
    var actionTarget by remember { mutableStateOf<Message?>(null) }
    var searchActive by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    var showClearConfirm by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val snackbarHost = remember { SnackbarHostState() }

    LaunchedEffect(chatId) { vm.bind(chatId) }
    LaunchedEffect(s.messages.size) { if (s.messages.isNotEmpty()) listState.animateScrollToItem(s.messages.lastIndex) }

    // Filter messages when searching
    val shown = s.searchQuery?.takeIf { it.isNotBlank() }
        ?.let { q -> s.messages.filter { (it.body ?: it.transcript ?: "").contains(q, ignoreCase = true) } }
        ?: s.messages

    Scaffold(
        containerColor = Tokens.AppBg,
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        if (searchActive) {
                            TextField(
                                value = searchText,
                                onValueChange = { searchText = it; vm.setSearch(it) },
                                placeholder = { Text("Search…", color = Tokens.TextMut) },
                                singleLine = true,
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                    focusedIndicatorColor = Tokens.Primary,
                                    unfocusedIndicatorColor = Tokens.Divider,
                                    cursorColor = Tokens.Primary,
                                    focusedTextColor = Tokens.TextMain,
                                    unfocusedTextColor = Tokens.TextMain,
                                ),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.clickable { vm.openContact() },
                            ) {
                                RemoteAvatar(name = title, url = vm.headerAvatarUrl(), size = 36)
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    text = title,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        if (searchActive) {
                            IconButton(onClick = {
                                searchActive = false
                                searchText = ""
                                vm.setSearch(null)
                            }) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Close search",
                                    tint = Tokens.TextMain,
                                )
                            }
                        } else {
                            IconButton(onClick = onBack) {
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = Tokens.TextMain,
                                )
                            }
                        }
                    },
                    actions = {
                        if (!searchActive) {
                            IconButton(onClick = { menuExpanded = true }) {
                                Icon(Icons.Filled.MoreVert, contentDescription = "More options", tint = Tokens.TextMain)
                            }
                            DropdownMenu(
                                expanded = menuExpanded,
                                onDismissRequest = { menuExpanded = false },
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Contact info") },
                                    onClick = { menuExpanded = false; vm.openContact() },
                                )
                                DropdownMenuItem(
                                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Tokens.TextMain) },
                                    text = { Text("Search in chat") },
                                    onClick = { menuExpanded = false; searchActive = true },
                                )
                                DropdownMenuItem(
                                    text = { Text("Clear chat", color = Tokens.Danger) },
                                    onClick = { menuExpanded = false; showClearConfirm = true },
                                )
                                DropdownMenuItem(
                                    text = { Text("Chat language") },
                                    onClick = { menuExpanded = false; vm.openLangSheet() },
                                )
                            }
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
                onSendImage = { b64, localUri -> vm.sendImage(b64, localUri) },
                replyTo = s.replyTo,
                onCancelReply = vm::clearReplyTo,
            )
        },
    ) { pad ->
        when {
            s.error != null && s.messages.isEmpty() -> {
                Column(
                    Modifier.fillMaxSize().padding(pad).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        s.error ?: "Couldn't load messages",
                        color = Tokens.TextMut,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(14.dp))
                    com.bondhu.app.ui.common.BondhuButton("Retry", onClick = { vm.retry() })
                }
            }
            s.loading && s.messages.isEmpty() -> {
                // Subtle thin top bar (not a jarring centered spinner). Only the
                // truly-first load of a chat reaches here — re-opens are instant
                // via the message cache.
                Box(Modifier.fillMaxSize().padding(pad)) {
                    LinearProgressIndicator(
                        modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                        color = Tokens.Primary,
                        trackColor = Tokens.Divider,
                    )
                }
            }
            !s.loading && shown.isEmpty() -> {
                EmptyState(
                    if (s.searchQuery?.isNotBlank() == true) "No results" else "No messages yet",
                    Modifier.padding(pad),
                )
            }
            else -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize().padding(pad),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    items(shown, key = { it.id }) { msg ->
                        val speaking = playback.id == "tts-${msg.id}" && playback.isPlaying
                        val isVoiceActive = playback.id == "voice-${msg.id}"
                        val isVoicePlaying = isVoiceActive && playback.isPlaying
                        val voiceProgress = if (isVoiceActive && playback.durationMs > 0)
                            playback.positionMs.toFloat() / playback.durationMs else 0f
                        val positionMs = if (isVoiceActive) playback.positionMs else 0L
                        val durationMs = if (isVoiceActive) playback.durationMs else 0L
                        val isTranscribing = msg.id in s.retranscribing
                        val imgUrl = msg.localImage ?: (if (msg.type == "image") vm.imageUrl(msg.id) else null)
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
                            imageUrl = imgUrl,
                            onOpenImage = { lightboxUrl = imgUrl },
                            onLongPress = { actionTarget = msg },
                        )
                    }
                }
            }
        }
    }

    // Language sheet
    LanguageSheet(
        open = s.langSheetOpen,
        current = s.chatLang,
        options = s.supported,
        onPick = { vm.setChatLanguage(it) },
        onDismiss = { vm.closeLangSheet() },
    )

    // Message actions (long press)
    MessageActionSheet(
        open = actionTarget != null,
        message = actionTarget,
        onReact = { emoji -> actionTarget?.let { vm.react(it, emoji) } },
        onReply = { actionTarget?.let { vm.setReplyTo(it) } },
        onForward = { actionTarget?.let { vm.openForward(it) } },
        onCopy = { actionTarget?.let { clipboard.setText(AnnotatedString(it.body ?: "")) } },
        onDeleteForMe = { actionTarget?.let { vm.deleteForMe(it) } },
        onDeleteForEveryone = { actionTarget?.let { vm.deleteForEveryone(it) } },
        onDismiss = { actionTarget = null },
    )

    // Contact info sheet
    ContactSheet(
        open = s.contactOpen,
        name = title,
        avatarUrl = vm.headerAvatarUrl(),
        contact = s.contact,
        onCopyNumber = { phone -> clipboard.setText(AnnotatedString(phone)) },
        onDismiss = { vm.closeContact() },
    )

    // Forward sheet
    val forwardTarget = s.forwardTarget
    ForwardSheet(
        open = forwardTarget != null,
        chats = s.forwardChats,
        media = vm.mediaBuilder,
        onPick = { jid ->
            forwardTarget?.let { vm.forward(it, listOf(jid)) }
            vm.closeForward()
        },
        onDismiss = { vm.closeForward() },
    )

    // Clear chat confirmation
    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            containerColor = Tokens.Header,
            title = { Text("Clear chat?", color = Tokens.TextMain) },
            text = { Text("All messages will be removed from this chat.", color = Tokens.TextMut) },
            confirmButton = {
                TextButton(onClick = { showClearConfirm = false; vm.clearChat() }) {
                    Text("Clear", color = Tokens.Danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) {
                    Text("Cancel", color = Tokens.TextMut)
                }
            },
        )
    }

    // Fullscreen image lightbox
    if (lightboxUrl != null) {
        Dialog(onDismissRequest = { lightboxUrl = null }) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.95f))
                    .clickable { lightboxUrl = null },
                contentAlignment = Alignment.Center,
            ) {
                AsyncImage(
                    model = lightboxUrl,
                    contentDescription = "Full image",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
