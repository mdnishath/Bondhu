package com.bondhu.app.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Forward
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens

private val REACTION_EMOJIS = listOf("👍", "❤️", "😂", "😮", "😢", "🙏")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageActionSheet(
    open: Boolean,
    message: Message?,
    onReact: (String) -> Unit,
    onReply: () -> Unit,
    onForward: () -> Unit,
    onCopy: () -> Unit,
    onEdit: () -> Unit,
    onDeleteForMe: () -> Unit,
    onDeleteForEveryone: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open || message == null) return

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Tokens.Header,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
        ) {
            // Reaction emoji row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                REACTION_EMOJIS.forEach { emoji ->
                    Text(
                        text = emoji,
                        fontSize = 26.sp,
                        modifier = Modifier
                            .clickable { onReact(emoji); onDismiss() }
                            .padding(4.dp),
                    )
                }
            }

            HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            Spacer(Modifier.height(4.dp))

            // Reply
            ActionRow(
                icon = Icons.AutoMirrored.Filled.Reply,
                label = "Reply",
                tint = Tokens.TextMain,
                onClick = { onReply(); onDismiss() },
            )

            // Forward
            ActionRow(
                icon = Icons.AutoMirrored.Filled.Forward,
                label = "Forward",
                tint = Tokens.TextMain,
                onClick = { onForward(); onDismiss() },
            )

            // Copy (only if body is available)
            if (!message.body.isNullOrBlank()) {
                ActionRow(
                    icon = Icons.Default.ContentCopy,
                    label = "Copy",
                    tint = Tokens.TextMain,
                    onClick = { onCopy(); onDismiss() },
                )
            }

            // Edit (own text messages only — backend supports WhatsApp message edit)
            if (message.fromMe && message.type == "text" && !message.body.isNullOrBlank()) {
                ActionRow(
                    icon = Icons.Default.Edit,
                    label = "Edit",
                    tint = Tokens.TextMain,
                    onClick = { onEdit(); onDismiss() },
                )
            }

            // Delete for me
            ActionRow(
                icon = Icons.Default.Delete,
                label = "Delete for me",
                tint = Tokens.Danger,
                onClick = { onDeleteForMe(); onDismiss() },
            )

            // Delete for everyone (only own messages)
            if (message.fromMe) {
                ActionRow(
                    icon = Icons.Default.Delete,
                    label = "Delete for everyone",
                    tint = Tokens.Danger,
                    onClick = { onDeleteForEveryone(); onDismiss() },
                )
            }
        }
    }
}

@Composable
private fun ActionRow(
    icon: ImageVector,
    label: String,
    tint: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        Text(label, color = tint, fontSize = 15.sp)
    }
}
