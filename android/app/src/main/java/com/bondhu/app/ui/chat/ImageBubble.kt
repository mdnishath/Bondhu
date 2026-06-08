package com.bondhu.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.bondhu.app.data.model.Message
import com.bondhu.app.ui.theme.Tokens

private val ImageShape = RoundedCornerShape(14.dp)

@Composable
fun ImageBubble(
    m: Message,
    imageUrl: String?,
    onOpen: () -> Unit,
) {
    Surface(shape = ImageShape) {
        Column {
            SubcomposeAsyncImage(
                model = imageUrl,
                contentDescription = "Image",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .sizeIn(maxWidth = 240.dp, maxHeight = 300.dp)
                    .clip(ImageShape)
                    .clickable { onOpen() },
                loading = {
                    Box(
                        modifier = Modifier
                            .size(180.dp)
                            .background(Tokens.Field),
                    )
                },
            )
            if (!m.body.isNullOrBlank()) {
                Text(
                    text = m.body,
                    color = Tokens.TextMain,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
    }
}
