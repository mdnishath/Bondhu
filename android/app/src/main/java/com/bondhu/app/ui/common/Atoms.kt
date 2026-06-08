package com.bondhu.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.core.animateFloat
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bondhu.app.ui.theme.Tokens

private val PillShape = RoundedCornerShape(50)

@Composable
fun BondhuButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(52.dp),
        shape = PillShape,
        colors = ButtonDefaults.buttonColors(containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary),
    ) {
        Text(text, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun BondhuField(
    value: String, onValueChange: (String) -> Unit, label: String,
    modifier: Modifier = Modifier, isPassword: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value, onValueChange = onValueChange, label = { Text(label) },
        singleLine = true, modifier = modifier.fillMaxWidth(),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
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
    // Glassy pill: elevated dark surface + hairline border
    Surface(
        color = Tokens.Surface,
        shape = PillShape,
        modifier = Modifier.border(1.dp, Tokens.Divider, PillShape),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(label, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier, cta: String? = null, onCta: (() -> Unit)? = null) {
    Box(modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, color = Tokens.TextMut, textAlign = TextAlign.Center)
            if (cta != null && onCta != null) {
                Spacer(Modifier.height(16.dp))
                BondhuButton(cta, onCta)
            }
        }
    }
}

/** Subtle shimmering placeholder block — used to build skeleton loaders. */
@Composable
fun Shimmer(modifier: Modifier = Modifier, shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(8.dp)) {
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "shimmer")
    val a by t.animateFloat(
        initialValue = 0.35f, targetValue = 0.85f,
        animationSpec = androidx.compose.animation.core.infiniteRepeatable(
            animation = androidx.compose.animation.core.tween(850),
            repeatMode = androidx.compose.animation.core.RepeatMode.Reverse,
        ),
        label = "shimmerAlpha",
    )
    Box(modifier.clip(shape).background(Tokens.Field.copy(alpha = a)))
}

/** Skeleton placeholder rows for the chat list while it loads. */
@Composable
fun ChatListSkeleton(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(horizontal = 10.dp, vertical = 6.dp)) {
        repeat(8) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 11.dp, horizontal = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Shimmer(Modifier.size(46.dp), CircleShape)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Shimmer(Modifier.fillMaxWidth(0.5f).height(13.dp))
                    Spacer(Modifier.height(8.dp))
                    Shimmer(Modifier.fillMaxWidth(0.8f).height(11.dp))
                }
            }
        }
    }
}

/** Thin "Reconnecting…" strip shown under the app bar when the socket is down. */
@Composable
fun ReconnectingBanner() {
    Surface(color = Tokens.Danger.copy(alpha = 0.18f), modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 5.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 2.dp, color = Tokens.Danger)
            Spacer(Modifier.width(8.dp))
            Text("Reconnecting…", color = Tokens.Danger, fontSize = 12.sp)
        }
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
