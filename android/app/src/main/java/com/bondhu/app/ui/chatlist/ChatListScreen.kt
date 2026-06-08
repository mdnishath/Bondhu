package com.bondhu.app.ui.chatlist

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ManageAccounts
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.RemoteAvatar
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
    onOpenChat: (String, String) -> Unit,
    onOpenSettings: () -> Unit = {},
    onSwitchAccount: () -> Unit = {},
    vm: ChatListViewModel = hiltViewModel(),
) {
    val s by vm.state.collectAsStateWithLifecycle()
    val connected by vm.socketConnected.collectAsStateWithLifecycle()
    var showNewChat by remember { mutableStateOf(false) }
    var newChatPhone by remember { mutableStateOf("") }

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
                            onOpenChat("${digits}@s.whatsapp.net", "+$digits")
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
                        // Brand logo (lime "B" badge) instead of a plain title
                        Surface(
                            color = Tokens.Primary,
                            shape = RoundedCornerShape(9.dp),
                            modifier = Modifier.size(34.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    "B",
                                    color = Tokens.OnPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                )
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = onSwitchAccount) {
                            Icon(
                                Icons.Default.ManageAccounts,
                                contentDescription = "Accounts",
                                tint = Tokens.TextMain,
                            )
                        }
                        IconButton(onClick = onOpenSettings) {
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = "Settings",
                                tint = Tokens.TextMain,
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Tokens.Header,
                        titleContentColor = Tokens.TextMain,
                    ),
                )
                HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
                if (!connected) com.bondhu.app.ui.common.ReconnectingBanner()
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
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 6.dp),
                ) {
                    items(s.chats, key = { it.jid }) { row ->
                        ChatRowItem(
                            row = row,
                            account = s.account,
                            vm = vm,
                            onClick = { onOpenChat(row.jid, row.title) },
                        )
                    }
                }
            }
        }
    }
}

private val CardShape = RoundedCornerShape(18.dp)

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
