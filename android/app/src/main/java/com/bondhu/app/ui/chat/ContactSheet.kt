package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.ProfileResponse
import com.bondhu.app.ui.common.RemoteAvatar
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactSheet(
    open: Boolean,
    name: String,
    avatarUrl: String?,
    contact: ProfileResponse?,
    onCopyNumber: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Tokens.Header,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            RemoteAvatar(name = name, url = avatarUrl, size = 96)
            Spacer(Modifier.height(12.dp))
            Text(
                text = name,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp,
                color = Tokens.TextMain,
            )
            Spacer(Modifier.height(8.dp))

            // Phone number row
            val phone = contact?.phone?.let { "+$it" }
            if (phone != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = phone,
                        fontSize = 15.sp,
                        color = Tokens.TextMut,
                    )
                    IconButton(onClick = { onCopyNumber(phone) }) {
                        Icon(
                            Icons.Default.ContentCopy,
                            contentDescription = "Copy number",
                            tint = Tokens.TextMut,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }

            // About / status
            val about = contact?.about
            if (!about.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = about,
                    fontSize = 14.sp,
                    color = Tokens.TextMut,
                )
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}
