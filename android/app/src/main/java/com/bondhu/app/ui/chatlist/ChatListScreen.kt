package com.bondhu.app.ui.chatlist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.ChatRow
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
fun ChatListScreen(onOpenChat: (String) -> Unit, vm: ChatListViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Bondhu") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* new chat – deferred layer */ }, containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary) {
                Icon(Icons.Default.Edit, "New chat")
            }
        },
    ) { pad ->
        when {
            s.loading -> Box(Modifier.fillMaxSize().padding(pad), Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
            s.chats.isEmpty() -> EmptyState("No chats yet.", Modifier.padding(pad))
            else -> LazyColumn(Modifier.fillMaxSize().padding(pad)) {
                items(s.chats, key = { it.jid }) { row ->
                    ChatRowItem(row, s.account, vm = vm, onClick = { onOpenChat(row.jid) })
                    HorizontalDivider(color = Tokens.Divider)
                }
            }
        }
    }
}

@Composable
private fun ChatRowItem(row: ChatRow, account: String?, vm: ChatListViewModel, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RemoteAvatar(name = row.title, url = vm.avatarUrl(row.jid))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(row.title, color = Tokens.TextMain, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(row.preview, color = Tokens.TextMut, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(shortTime(row.timestamp), color = Tokens.TextMut, fontSize = 11.sp)
            if (row.unread > 0) {
                Spacer(Modifier.height(4.dp))
                Badge(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary) { Text(row.unread.toString()) }
            }
        }
    }
}
