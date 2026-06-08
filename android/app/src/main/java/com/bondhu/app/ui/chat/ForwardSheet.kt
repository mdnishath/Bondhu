package com.bondhu.app.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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
    onConfirm: (List<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return

    // Multi-select: tick several chats, then confirm. Reset each time the sheet opens.
    var selected by remember(chats) { mutableStateOf(setOf<String>()) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Tokens.Header,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = if (selected.isEmpty()) "Forward to" else "Forward to ${selected.size}",
                color = Tokens.TextMain,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            )
            HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 420.dp),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(chats, key = { it.jid }) { chat ->
                    val checked = chat.jid in selected
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selected = if (checked) selected - chat.jid else selected + chat.jid
                            }
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
                        Checkbox(
                            checked = checked,
                            onCheckedChange = {
                                selected = if (it) selected + chat.jid else selected - chat.jid
                            },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Tokens.Primary,
                                checkmarkColor = Tokens.OnPrimary,
                                uncheckedColor = Tokens.TextMut,
                            ),
                        )
                    }
                }
            }
            HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onDismiss) { Text("Cancel", color = Tokens.TextMut) }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = { if (selected.isNotEmpty()) onConfirm(selected.toList()) },
                    enabled = selected.isNotEmpty(),
                    shape = RoundedCornerShape(50),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Tokens.Primary,
                        contentColor = Tokens.OnPrimary,
                        disabledContainerColor = Tokens.Field,
                        disabledContentColor = Tokens.TextMut,
                    ),
                ) {
                    Text(if (selected.isEmpty()) "Forward" else "Forward (${selected.size})")
                }
            }
        }
    }
}
