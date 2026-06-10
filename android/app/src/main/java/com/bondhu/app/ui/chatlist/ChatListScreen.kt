package com.bondhu.app.ui.chatlist

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Radii
import com.bondhu.app.ui.theme.Tokens
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// ts is epoch millis (backend normalises all timestamps to ms).
private fun shortTime(ts: Long): String =
    if (ts <= 0) "" else SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ts))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    onOpenChat: (String, String, Int) -> Unit,
    onOpenSettings: () -> Unit = {},
    onSwitchAccount: () -> Unit = {},
    vm: ChatListViewModel = hiltViewModel(),
) {
    val s by vm.state.collectAsStateWithLifecycle()
    val connected by vm.socketConnected.collectAsStateWithLifecycle()
    var showNewChat by remember { mutableStateOf(false) }
    var newChatPhone by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }

    // Filter the (already-loaded) chat list by name — same as the web search box.
    val shownChats = remember(s.chats, searchQuery) {
        val q = searchQuery.trim()
        if (q.isBlank()) s.chats
        else s.chats.filter { it.title.contains(q, ignoreCase = true) }
    }

    // Hardware back clears the search before leaving the screen.
    BackHandler(enabled = searchQuery.isNotEmpty()) { searchQuery = "" }

    if (showNewChat) {
        AlertDialog(
            onDismissRequest = { showNewChat = false; newChatPhone = "" },
            containerColor = Tokens.Surface,
            shape = RoundedCornerShape(20.dp),
            title = { Text("New chat", color = Tokens.TextMain, fontWeight = FontWeight.SemiBold) },
            text = {
                BondhuField(
                    value = newChatPhone,
                    onValueChange = { newChatPhone = it },
                    label = "Phone number (with country code)",
                    keyboardType = KeyboardType.Phone,
                )
            },
            confirmButton = {
                BondhuButton(
                    text = "Start chat",
                    onClick = {
                        val digits = newChatPhone.filter { it.isDigit() }
                        if (digits.isNotEmpty()) {
                            onOpenChat("${digits}@s.whatsapp.net", "+$digits", 0)
                        }
                        showNewChat = false
                        newChatPhone = ""
                    },
                )
            },
            dismissButton = {
                TextButton(onClick = { showNewChat = false; newChatPhone = "" }) {
                    Text("Cancel", color = Tokens.TextMut)
                }
            },
        )
    }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        // Brand logo (lime "B" badge)
                        Surface(
                            color = Tokens.Primary,
                            shape = RoundedCornerShape(9.dp),
                            modifier = Modifier.size(34.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("B", color = Tokens.OnPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = onSwitchAccount) {
                            Icon(Icons.Default.ManageAccounts, contentDescription = "Accounts", tint = Tokens.TextMain)
                        }
                        IconButton(onClick = onOpenSettings) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Tokens.TextMain)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Tokens.Header,
                        titleContentColor = Tokens.TextMain,
                    ),
                )
                HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
                if (!connected) com.bondhu.app.ui.common.ReconnectingBanner()
                s.update?.let { u ->
                    Surface(color = Tokens.Primary.copy(alpha = 0.16f), modifier = Modifier.fillMaxWidth()) {
                        Row(
                            Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp, top = 6.dp, bottom = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Update available — v${u.versionName}",
                                color = Tokens.Primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(onClick = { vm.runUpdate() }) { Text("Update", color = Tokens.Primary, fontWeight = FontWeight.SemiBold) }
                            IconButton(onClick = { vm.dismissUpdate() }) { Icon(Icons.Default.Close, "Dismiss", tint = Tokens.TextMut) }
                        }
                    }
                }
                // Always-visible search bar (web-style), matched to the app's glassy field.
                Surface(
                    color = Tokens.Field,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(start = 12.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = Tokens.TextMut, modifier = Modifier.size(18.dp))
                        BasicTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            singleLine = true,
                            textStyle = androidx.compose.ui.text.TextStyle(color = Tokens.TextMain, fontSize = 14.sp),
                            cursorBrush = SolidColor(Tokens.Primary),
                            modifier = Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 13.dp),
                            decorationBox = { inner ->
                                if (searchQuery.isEmpty()) {
                                    Text("Search chats", color = Tokens.TextMut, fontSize = 14.sp)
                                }
                                inner()
                            },
                        )
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", tint = Tokens.TextMut, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showNewChat = true },
                containerColor = Tokens.Primary,
                contentColor = Tokens.OnPrimary,
            ) {
                Icon(Icons.Default.Edit, "New chat")
            }
        },
    ) { pad ->
        PullToRefreshBox(
            isRefreshing = s.refreshing,
            onRefresh = { vm.manualRefresh() },
            modifier = Modifier.fillMaxSize().padding(pad),
        ) {
            when {
                s.loading -> com.bondhu.app.ui.common.ChatListSkeleton()
                s.chats.isEmpty() -> EmptyState(
                    "No chats yet.\nStart a conversation to see it here.",
                    cta = "New chat",
                    onCta = { showNewChat = true },
                )
                shownChats.isEmpty() -> EmptyState("No chats match “${searchQuery.trim()}”.")
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 6.dp),
                ) {
                    items(shownChats, key = { it.jid }) { row ->
                        ChatRowItem(
                            row = row,
                            account = s.account,
                            vm = vm,
                            onClick = { onOpenChat(row.jid, row.title, row.unread) },
                        )
                    }
                }
            }
        }
    }

    if (s.showOnboarding) {
        Dialog(
            onDismissRequest = { vm.dismissOnboarding() },
            properties = DialogProperties(usePlatformDefaultWidth = false),
        ) {
            Box(Modifier.fillMaxSize().background(Tokens.AppBg), contentAlignment = Alignment.Center) {
                Column(
                    Modifier.padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Surface(color = Tokens.Primary, shape = RoundedCornerShape(18.dp), modifier = Modifier.size(68.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("B", color = Tokens.OnPrimary, fontWeight = FontWeight.Bold, fontSize = 34.sp)
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                    Text("Welcome to Bondhu", color = Tokens.TextMain, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Chat across languages. Type or speak in Bangla — your contact reads it in theirs, and their replies come back to you translated.",
                        color = Tokens.TextMut, textAlign = TextAlign.Center, fontSize = 14.sp,
                    )
                    Spacer(Modifier.height(22.dp))
                    OnboardBullet("🌐", "Two-way live translation")
                    OnboardBullet("🎤", "Voice → transcript → translated voice note")
                    OnboardBullet("💬", "Reactions, replies, edit, forward & more")
                    Spacer(Modifier.height(30.dp))
                    BondhuButton("Get started", onClick = { vm.dismissOnboarding() }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
private fun OnboardBullet(emoji: String, text: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(emoji, fontSize = 18.sp)
        Spacer(Modifier.width(12.dp))
        Text(text, color = Tokens.TextMain, fontSize = 14.sp)
    }
}

private val CardShape = RoundedCornerShape(Radii.md)

@Composable
private fun ChatRowItem(row: ChatRow, account: String?, vm: ChatListViewModel, onClick: () -> Unit) {
    Surface(
        color = Tokens.Surface,
        shape = CardShape,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 5.dp)
            .border(1.dp, Tokens.Divider, CardShape),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RemoteAvatar(name = row.title, url = vm.avatarUrl(row.jid))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    row.title,
                    color = Tokens.TextMain,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    row.preview,
                    color = Tokens.TextMut,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(shortTime(row.timestamp), color = Tokens.TextMut, fontSize = 11.sp)
                if (row.unread > 0) {
                    Spacer(Modifier.height(4.dp))
                    Badge(
                        containerColor = Tokens.Primary,
                        contentColor = Tokens.OnPrimary,
                    ) {
                        Text(row.unread.toString())
                    }
                }
            }
        }
    }
}
