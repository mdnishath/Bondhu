package com.bondhu.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.ui.theme.Tokens

@Composable
fun BondhuButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick, enabled = enabled, modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(24.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary),
    ) { Text(text, fontWeight = FontWeight.SemiBold) }
}

@Composable
fun BondhuField(
    value: String, onValueChange: (String) -> Unit, label: String,
    modifier: Modifier = Modifier, isPassword: Boolean = false, keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
) {
    OutlinedTextField(
        value = value, onValueChange = onValueChange, label = { Text(label) },
        singleLine = true, modifier = modifier.fillMaxWidth(),
        visualTransformation = if (isPassword) androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Tokens.Field, unfocusedContainerColor = Tokens.Field,
            focusedBorderColor = Tokens.Primary, unfocusedBorderColor = Color.Transparent,
            focusedLabelColor = Tokens.Primary, unfocusedLabelColor = Tokens.TextMut,
            cursorColor = Tokens.Primary,
        ),
        shape = RoundedCornerShape(14.dp),
    )
}

@Composable
fun Avatar(name: String?, modifier: Modifier = Modifier, size: Int = 46) {
    Box(
        modifier = modifier.size(size.dp).clip(CircleShape).background(avColor(name)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials(name), color = Tokens.AppBg, fontWeight = FontWeight.SemiBold, fontSize = (size * 0.4).sp)
    }
}

enum class ConnUi { Connected, Connecting, QrPending, Pairing, Disconnected }

@Composable
fun StatusChip(state: ConnUi) {
    val (label, color) = when (state) {
        ConnUi.Connected -> "Connected" to Tokens.Online
        ConnUi.Connecting -> "Authenticating" to Tokens.TextMut
        ConnUi.QrPending -> "Scan QR" to Tokens.TextMut
        ConnUi.Pairing -> "Pairing" to Tokens.TextMut
        ConnUi.Disconnected -> "Disconnected" to Tokens.Danger
    }
    Surface(color = color.copy(alpha = 0.16f), shape = RoundedCornerShape(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, color = Tokens.TextMut, textAlign = TextAlign.Center)
    }
}

@Composable
fun ErrorBanner(message: String, onDismiss: () -> Unit) {
    Surface(color = Tokens.Danger.copy(alpha = 0.15f), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(message, color = Tokens.Danger, modifier = Modifier.weight(1f))
            TextButton(onClick = onDismiss) { Text("Dismiss", color = Tokens.Danger) }
        }
    }
}
