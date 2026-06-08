package com.bondhu.app.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.api.MediaUrlBuilder
import com.bondhu.app.data.model.ChatRow
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForwardSheet(
    open: Boolean,
    chats: List<ChatRow>,
    media: MediaUrlBuilder,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Tokens.Header,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Forward to",
                color = Tokens.TextMain,
                fontSize = 16.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            )
            HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
                    .navigationBarsPadding(),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(chats, key = { it.jid }) { chat ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(chat.jid) }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        RemoteAvatar(name = chat.title, url = media.profilePic(chat.jid), size = 42)
                        Text(
                            text = chat.title,
                            color = Tokens.TextMain,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}
