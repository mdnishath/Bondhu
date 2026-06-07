package com.bondhu.app.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Composer(
    draft: String,
    sending: Boolean,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
    sendMode: String = "text",
    outLang: String? = null,
    supported: List<LangOption> = emptyList(),
    onSetMode: (String) -> Unit = {},
    onSetOutLang: (String?) -> Unit = {},
) {
    var showLangSheet by remember { mutableStateOf(false) }

    val selectedLang = supported.firstOrNull { it.code == outLang }
    val langLabel = if (selectedLang != null) "${selectedLang.flag} ${selectedLang.name}" else "🌐 Language"
    val isVoiceMode = sendMode == "voice" && outLang != null

    val placeholder = when {
        isVoiceMode -> "Type — sent as ${selectedLang?.name ?: outLang} voice 🔊"
        outLang != null -> "Type — sent in ${selectedLang?.name ?: outLang}"
        else -> "Type — sent in your language"
    }

    Surface(color = Tokens.Header) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)) {
            // Mode toggle + language chip row (above the text field)
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                // Text mode chip
                FilterChip(
                    selected = sendMode == "text",
                    onClick = { onSetMode("text") },
                    label = { Text("Aa", style = MaterialTheme.typography.labelSmall) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Tokens.Primary.copy(alpha = 0.25f),
                        selectedLabelColor = Tokens.Primary,
                        containerColor = Tokens.Field,
                        labelColor = Tokens.TextMut,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = sendMode == "text",
                        borderColor = Color.Transparent,
                        selectedBorderColor = Color.Transparent,
                    ),
                )
                // Voice mode chip (disabled when outLang == null)
                FilterChip(
                    selected = isVoiceMode,
                    enabled = outLang != null,
                    onClick = { onSetMode("voice") },
                    label = { Text("🎙️", style = MaterialTheme.typography.labelSmall) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Tokens.Primary.copy(alpha = 0.25f),
                        selectedLabelColor = Tokens.Primary,
                        containerColor = Tokens.Field,
                        labelColor = Tokens.TextMut,
                        disabledContainerColor = Tokens.Field.copy(alpha = 0.5f),
                        disabledLabelColor = Tokens.TextMut.copy(alpha = 0.4f),
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = outLang != null,
                        selected = isVoiceMode,
                        borderColor = Color.Transparent,
                        selectedBorderColor = Color.Transparent,
                        disabledBorderColor = Color.Transparent,
                        disabledSelectedBorderColor = Color.Transparent,
                    ),
                )
                // Language picker chip
                FilterChip(
                    selected = outLang != null,
                    onClick = { showLangSheet = true },
                    label = {
                        Text(
                            langLabel,
                            style = MaterialTheme.typography.labelSmall,
                            maxLines = 1,
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Tokens.Primary.copy(alpha = 0.15f),
                        selectedLabelColor = Tokens.Primary,
                        containerColor = Tokens.Field,
                        labelColor = Tokens.TextMut,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = outLang != null,
                        borderColor = Color.Transparent,
                        selectedBorderColor = Tokens.Primary.copy(alpha = 0.4f),
                    ),
                )
            }

            // Text field + send button row
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = draft, onValueChange = onDraft, modifier = Modifier.weight(1f),
                    placeholder = { Text(placeholder, color = Tokens.TextMut) }, maxLines = 5,
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

    LanguageSheet(
        open = showLangSheet,
        current = outLang,
        options = supported,
        onPick = { code ->
            onSetOutLang(code)
            // If voice mode selected but lang is cleared, switch back to text
            if (code == null && sendMode == "voice") onSetMode("text")
        },
        onDismiss = { showLangSheet = false },
    )
}
