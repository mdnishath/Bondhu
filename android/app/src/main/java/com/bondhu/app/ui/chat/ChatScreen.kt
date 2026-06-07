package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(chatId: String, title: String, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    LaunchedEffect(chatId) { vm.bind(chatId) }
    LaunchedEffect(s.messages.size) { if (s.messages.isNotEmpty()) listState.animateScrollToItem(s.messages.lastIndex) }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain, navigationIconContentColor = Tokens.TextMain),
            )
        },
        bottomBar = { Composer(s.draft, s.sending, vm::onDraft, vm::send) },
    ) { pad ->
        if (s.loading) {
            Box(Modifier.fillMaxSize().padding(pad), androidx.compose.ui.Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
        } else {
            LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(pad), contentPadding = PaddingValues(vertical = 8.dp)) {
                items(s.messages, key = { it.id }) { MessageBubble(it) }
            }
        }
    }
}
