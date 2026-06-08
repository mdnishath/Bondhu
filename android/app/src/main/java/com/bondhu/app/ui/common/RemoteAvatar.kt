package com.bondhu.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.bondhu.app.ui.theme.Tokens

/**
 * Avatar that shows coloured initials as background/placeholder, then overlays
 * the profile photo once Coil loads it. On 404 or null URL the initials remain.
 *
 * Coil uses its OWN default ImageLoader (not the app's Retrofit OkHttp client).
 * The URL is already fully-qualified and carries `?token=` — no extra auth needed.
 */
@Composable
fun RemoteAvatar(name: String?, url: String?, modifier: Modifier = Modifier, size: Int = 46) {
    Box(
        modifier = modifier.size(size.dp).clip(CircleShape).background(avColor(name)),
        contentAlignment = Alignment.Center,
    ) {
        // Initials layer (always visible until/unless photo loads)
        Text(
            text = initials(name),
            color = Tokens.AppBg,
            fontWeight = FontWeight.SemiBold,
            fontSize = (size * 0.4).sp,
        )

        // Photo layer — clips to circle; initials show on loading/error
        if (url != null) {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = name,
                modifier = Modifier.matchParentSize().clip(CircleShape),
                loading = {},   // keep initials visible while loading
                error = {},     // keep initials visible on error/404
            )
        }
    }
}
