package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun Composer(draft: String, sending: Boolean, onDraft: (String) -> Unit, onSend: () -> Unit) {
    Surface(color = Tokens.Header) {
        Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft, onValueChange = onDraft, modifier = Modifier.weight(1f),
                placeholder = { Text("Message", color = Tokens.TextMut) }, maxLines = 5,
                shape = RoundedCornerShape(22.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Tokens.Field, unfocusedContainerColor = Tokens.Field,
                    focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent,
                    cursorColor = Tokens.Primary, focusedTextColor = Tokens.TextMain, unfocusedTextColor = Tokens.TextMain,
                ),
            )
            Spacer(Modifier.width(8.dp))
            FloatingActionButton(
                onClick = onSend, containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary,
                modifier = Modifier.size(48.dp),
            ) { Icon(Icons.Default.Send, "Send") }
        }
    }
}
