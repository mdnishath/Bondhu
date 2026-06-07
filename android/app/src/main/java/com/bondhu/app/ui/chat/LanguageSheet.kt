package com.bondhu.app.ui.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.data.model.LangOption
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LanguageSheet(
    open: Boolean,
    current: String?,
    options: List<LangOption>,
    onPick: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }
    val filtered = remember(query, options) {
        if (query.isBlank()) options
        else options.filter { it.name.contains(query, ignoreCase = true) || it.code.contains(query, ignoreCase = true) }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Tokens.Header,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            Text(
                "Send language",
                style = MaterialTheme.typography.titleMedium,
                color = Tokens.TextMain,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search…", color = Tokens.TextMut) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Tokens.Field,
                    unfocusedContainerColor = Tokens.Field,
                    focusedBorderColor = Tokens.Primary,
                    unfocusedBorderColor = Tokens.Field,
                    cursorColor = Tokens.Primary,
                    focusedTextColor = Tokens.TextMain,
                    unfocusedTextColor = Tokens.TextMain,
                ),
            )
            Spacer(Modifier.height(8.dp))
        }

        LazyColumn(
            modifier = Modifier.fillMaxWidth().heightIn(max = 400.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        ) {
            // "Default / Send as typed" row maps to null
            if (query.isBlank()) {
                item(key = "__default__") {
                    LangRow(
                        flag = "🌐",
                        label = "Send as typed (default)",
                        selected = current == null,
                        onClick = { onPick(null); onDismiss() },
                    )
                    HorizontalDivider(color = Tokens.Field, thickness = 0.5.dp)
                }
            }
            items(filtered, key = { it.code }) { opt ->
                LangRow(
                    flag = opt.flag,
                    label = opt.name,
                    selected = opt.code == current,
                    onClick = { onPick(opt.code); onDismiss() },
                )
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun LangRow(flag: String, label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(flag, fontSize = 22.sp, modifier = Modifier.width(36.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            label,
            color = if (selected) Tokens.Primary else Tokens.TextMain,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Text("✓", color = Tokens.Primary, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
