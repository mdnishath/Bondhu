package com.bondhu.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Forward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.bondhu.app.data.model.Message
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Tokens
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, title: String, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val playback by vm.playback.collectAsStateWithLifecycle()
    val connected by vm.socketConnected.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    var menuExpanded by remember { mutableStateOf(false) }
    var lightboxUrl by remember { mutableStateOf<String?>(null) }
    var actionTarget by remember { mutableStateOf<Message?>(null) }
    var searchActive by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    var showClearConfirm by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(setOf<String>()) }
    var showBulkDelete by remember { mutableStateOf(false) }
    var flashId by remember { mutableStateOf<String?>(null) }
    val selectionMode = selected.isNotEmpty()
    fun toggleSelect(id: String) { selected = if (id in selected) selected - id else selected + id }
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    fun downloadFile(msg: Message) {
        val url = vm.fileUrl(msg.id) ?: return
        val name = msg.body?.takeIf { it.isNotBlank() } ?: "bondhu_file"
        try {
            val req = android.app.DownloadManager.Request(android.net.Uri.parse(url))
                .setTitle(name)
                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, name)
            (context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as android.app.DownloadManager).enqueue(req)
        } catch (_: Exception) { /* surfaced below */ }
    }
    val snackbarHost = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    // Whether the list is scrolled to (near) the bottom.
    val atBottom by remember {
        derivedStateOf {
            val li = listState.layoutInfo
            val last = li.visibleItemsInfo.lastOrNull()
            last == null || last.index >= li.totalItemsCount - 1
        }
    }
    var newCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(chatId) { vm.bind(chatId) }
    // Stick to bottom only when a NEW last message arrives AND the user is already
    // at the bottom (or it's our own message). Otherwise count it as "new" and let
    // the user pull down via the scroll-to-bottom FAB — don't yank their view.
    val lastMsgId = s.messages.lastOrNull()?.id
    LaunchedEffect(lastMsgId) {
        if (s.searchQuery.isNullOrBlank() && s.messages.isNotEmpty()) {
            val last = s.messages.last()
            if (atBottom || last.fromMe) {
                listState.animateScrollToItem(s.messages.lastIndex)
                newCount = 0
            } else {
                newCount++
            }
        }
    }
    LaunchedEffect(atBottom) { if (atBottom) newCount = 0 }
    LaunchedEffect(flashId) { if (flashId != null) { kotlinx.coroutines.delay(1500); flashId = null } }
    // Infinite older-history: page in when the user scrolls near the top.
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .collect { idx -> if (idx <= 2) vm.loadOlder() }
    }
    // Surface transient action errors (send/react/delete/edit/forward) via snackbar
    // — the empty-state Retry screen already covers the initial-load failure.
    LaunchedEffect(s.error) {
        if (s.error != null && s.messages.isNotEmpty()) {
            snackbarHost.showSnackbar(s.error!!)
            vm.clearError()
        }
    }

    // When searching, show backend results (full chat history); else the live list.
    val searching = !s.searchQuery.isNullOrBlank()
    val shown = if (searching) s.searchResults else s.messages

    Scaffold(
        containerColor = Tokens.AppBg,
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
          if (selectionMode) {
            SelectionTopBar(
                count = selected.size,
                onClose = { selected = emptySet() },
                onForward = { vm.openForwardIds(selected.toList()) },
                onDelete = { showBulkDelete = true },
            )
          } else {
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
                                Column {
                                    Text(text = title, fontWeight = FontWeight.SemiBold)
                                    if (s.presence != null) {
                                        Text(
                                            s.presence!!,
                                            color = if (s.presence == "typing…" || s.presence == "recording…") Tokens.Primary else Tokens.TextMut,
                                            fontSize = 11.sp,
                                        )
                                    }
                                }
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
                            IconButton(onClick = { searchActive = true }) {
                                Icon(Icons.Default.Search, contentDescription = "Search in chat", tint = Tokens.TextMain)
                            }
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
                if (!connected) com.bondhu.app.ui.common.ReconnectingBanner()
            }
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
                onSendImage = { b64, localUri, caption -> vm.sendImage(b64, localUri, caption) },
                onSendDocument = { b64, name, mime -> vm.sendDocument(b64, name, mime) },
                replyTo = s.replyTo,
                onCancelReply = vm::clearReplyTo,
                editing = s.editing,
                onCancelEdit = vm::cancelEdit,
                voiceLang = s.voiceLang,
                onSetVoiceLang = vm::setVoiceLang,
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
                    if (s.searching) "Searching…" else if (searching) "No results" else "No messages yet",
                    Modifier.padding(pad),
                )
            }
            else -> {
              Box(Modifier.fillMaxSize().padding(pad)) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 8.dp),
                ) {
                    itemsIndexed(shown, key = { _, m -> m.id }) { i, msg ->
                        if (i == 0 || dayKey(shown[i - 1].timestamp) != dayKey(msg.timestamp)) {
                            DateSeparator(dayLabel(msg.timestamp))
                        }
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
                            voiceSpeed = if (isVoiceActive) playback.speed else 1f,
                            onCycleSpeed = { vm.cycleVoiceSpeed() },
                            imageUrl = imgUrl,
                            onOpenImage = { lightboxUrl = imgUrl },
                            onLongPress = { if (selectionMode) toggleSelect(msg.id) else actionTarget = msg },
                            onRetry = { vm.retrySend(msg) },
                            selected = (msg.id in selected) || (msg.id == flashId),
                            onTap = if (selectionMode) ({ toggleSelect(msg.id) }) else null,
                            onJumpToQuoted = { qid ->
                                val idx = shown.indexOfFirst { it.id == qid }
                                if (idx >= 0) { scope.launch { listState.animateScrollToItem(idx) }; flashId = qid }
                            },
                            onDownload = { downloadFile(msg); scope.launch { snackbarHost.showSnackbar("Downloading… check notifications") } },
                        )
                    }
                }
                if (!atBottom) {
                    Box(Modifier.align(Alignment.BottomEnd).padding(16.dp)) {
                        SmallFloatingActionButton(
                            onClick = { scope.launch { listState.animateScrollToItem(shown.lastIndex.coerceAtLeast(0)) } },
                            containerColor = Tokens.Surface,
                            contentColor = Tokens.Primary,
                        ) { Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Scroll to bottom") }
                        if (newCount > 0) {
                            Surface(
                                color = Tokens.Primary,
                                shape = androidx.compose.foundation.shape.CircleShape,
                                modifier = Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-4).dp),
                            ) {
                                Text(
                                    newCount.toString(), color = Tokens.OnPrimary, fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
                                )
                            }
                        }
                    }
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
        onCopy = { actionTarget?.let { clipboard.setText(AnnotatedString(it.body ?: it.transcript ?: "")); scope.launch { snackbarHost.showSnackbar("Copied") } } },
        onEdit = { actionTarget?.let { vm.startEdit(it) } },
        onSelect = { actionTarget?.let { selected = selected + it.id } },
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

    // Forward sheet (single message or bulk selection)
    ForwardSheet(
        open = s.forwardIds.isNotEmpty(),
        chats = s.forwardChats,
        media = vm.mediaBuilder,
        onConfirm = { jids ->
            vm.forwardCurrent(jids)
            vm.closeForward()
            selected = emptySet()
            scope.launch { snackbarHost.showSnackbar("Forwarded") }
        },
        onDismiss = { vm.closeForward() },
    )

    // Bulk delete confirmation
    if (showBulkDelete) {
        AlertDialog(
            onDismissRequest = { showBulkDelete = false },
            containerColor = Tokens.Header,
            title = { Text("Delete ${selected.size} message(s)?", color = Tokens.TextMain) },
            text = { Text("They'll be removed from this device.", color = Tokens.TextMut) },
            confirmButton = {
                TextButton(onClick = { showBulkDelete = false; vm.deleteForMeIds(selected); selected = emptySet() }) {
                    Text("Delete", color = Tokens.Danger)
                }
            },
            dismissButton = { TextButton(onClick = { showBulkDelete = false }) { Text("Cancel", color = Tokens.TextMut) } },
        )
    }

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

    // Fullscreen image lightbox — pinch-zoom, pan, double-tap zoom, swipe-down to dismiss
    if (lightboxUrl != null) {
        Dialog(
            onDismissRequest = { lightboxUrl = null },
            properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false),
        ) {
            var scale by remember { mutableFloatStateOf(1f) }
            var offsetX by remember { mutableFloatStateOf(0f) }
            var offsetY by remember { mutableFloatStateOf(0f) }
            var dismissY by remember { mutableFloatStateOf(0f) }
            val transState = rememberTransformableState { zoom, pan, _ ->
                scale = (scale * zoom).coerceIn(1f, 5f)
                if (scale > 1f) { offsetX += pan.x; offsetY += pan.y }
            }
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.97f))
                    .pointerInput(Unit) {
                        detectVerticalDragGestures(
                            onDragEnd = { if (kotlin.math.abs(dismissY) > 280f) lightboxUrl = null else dismissY = 0f },
                        ) { _, dy -> if (scale <= 1f) dismissY += dy }
                    }
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onTap = { lightboxUrl = null },
                            onDoubleTap = { if (scale > 1f) { scale = 1f; offsetX = 0f; offsetY = 0f } else scale = 2.5f },
                        )
                    },
                contentAlignment = Alignment.Center,
            ) {
                AsyncImage(
                    model = lightboxUrl,
                    contentDescription = "Full image",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .offset { IntOffset(offsetX.roundToInt(), (offsetY + dismissY).roundToInt()) }
                        .graphicsLayer(scaleX = scale, scaleY = scale)
                        .transformable(transState),
                )
            }
        }
    }
}

/** Day bucket key (year+dayOfYear) to detect date boundaries between messages. */
private fun dayKey(ts: Long): Long {
    if (ts <= 0) return 0
    val c = Calendar.getInstance().apply { timeInMillis = ts }
    return c.get(Calendar.YEAR) * 1000L + c.get(Calendar.DAY_OF_YEAR)
}

/** Human date label: Today / Yesterday / "12 Jun 2026". */
private fun dayLabel(ts: Long): String {
    if (ts <= 0) return ""
    val now = Calendar.getInstance()
    val msg = Calendar.getInstance().apply { timeInMillis = ts }
    fun same(a: Calendar, b: Calendar) =
        a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)
    if (same(now, msg)) return "Today"
    now.add(Calendar.DAY_OF_YEAR, -1)
    if (same(now, msg)) return "Yesterday"
    return SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(Date(ts))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SelectionTopBar(count: Int, onClose: () -> Unit, onForward: () -> Unit, onDelete: () -> Unit) {
    Column {
        TopAppBar(
            title = { Text("$count selected", fontWeight = FontWeight.SemiBold) },
            navigationIcon = {
                IconButton(onClick = onClose) { Icon(Icons.Default.Close, "Cancel selection", tint = Tokens.TextMain) }
            },
            actions = {
                IconButton(onClick = onForward) { Icon(Icons.AutoMirrored.Filled.Forward, "Forward", tint = Tokens.TextMain) }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, "Delete", tint = Tokens.Danger) }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Tokens.Header,
                titleContentColor = Tokens.TextMain,
                navigationIconContentColor = Tokens.TextMain,
            ),
        )
        HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
    }
}

@Composable
private fun DateSeparator(label: String) {
    if (label.isEmpty()) return
    Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Surface(
            color = Tokens.Surface,
            shape = RoundedCornerShape(50),
            modifier = Modifier.border(1.dp, Tokens.Divider, RoundedCornerShape(50)),
        ) {
            Text(
                label,
                color = Tokens.TextMut,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            )
        }
    }
}
