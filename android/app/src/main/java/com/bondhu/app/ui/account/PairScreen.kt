package com.bondhu.app.ui.account

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.common.QrImage
import com.bondhu.app.ui.theme.InterFamily
import com.bondhu.app.ui.theme.Tokens

private val CardShape   = RoundedCornerShape(20.dp)
private val DigitShape  = RoundedCornerShape(10.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairScreen(accountId: String, onConnected: () -> Unit, vm: PairViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(0) }
    LaunchedEffect(accountId) { vm.bind(accountId) }
    LaunchedEffect(s.connected) { if (s.connected) onConnected() }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Text(
                            "Link a device",
                            fontFamily = InterFamily,
                            fontWeight = FontWeight.SemiBold,
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Tokens.Header,
                        titleContentColor = Tokens.TextMain,
                    ),
                )
                HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            }
        },
        bottomBar = {
            Surface(color = Tokens.Header) {
                Column(Modifier.fillMaxWidth()) {
                    HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
                    Text(
                        when (s.state) {
                            "connected"  -> "Connected"
                            "qr_pending" -> "Waiting for you to scan…"
                            "pairing"    -> "Enter the code in WhatsApp"
                            else         -> s.state
                        },
                        color = Tokens.TextMut,
                        fontFamily = InterFamily,
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        },
    ) { pad ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(pad)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ── Glassy main card ──────────────────────────────────────────
            Surface(
                color = Tokens.Surface,
                shape = CardShape,
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Tokens.Divider, CardShape),
            ) {
                Column(
                    Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // Tab row: QR / Pairing code
                    TabRow(
                        selectedTabIndex = tab,
                        containerColor = Tokens.Field,
                        contentColor = Tokens.Primary,
                    ) {
                        Tab(
                            selected = tab == 0,
                            onClick = { tab = 0 },
                            text = { Text("QR code", fontFamily = InterFamily, fontWeight = FontWeight.Medium) },
                        )
                        Tab(
                            selected = tab == 1,
                            onClick = { tab = 1 },
                            text = { Text("Pairing code", fontFamily = InterFamily, fontWeight = FontWeight.Medium) },
                        )
                    }

                    Spacer(Modifier.height(24.dp))

                    if (tab == 0) {
                        // QR tab
                        if (s.qr.isNullOrEmpty()) {
                            CircularProgressIndicator(color = Tokens.Primary)
                            Spacer(Modifier.height(12.dp))
                            Text("Generating QR…", color = Tokens.TextMut, fontFamily = InterFamily)
                        } else {
                            // QR must sit on white for scanning
                            Surface(
                                color = Color.White,
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                QrImage(s.qr!!, Modifier.size(240.dp).padding(12.dp))
                            }
                            Spacer(Modifier.height(16.dp))
                            Text(
                                "WhatsApp › Linked Devices › Link a device",
                                color = Tokens.TextMut,
                                fontFamily = InterFamily,
                                textAlign = TextAlign.Center,
                            )
                        }
                    } else {
                        // Pairing code tab
                        Text(
                            "Enter the number to link, then type this code in WhatsApp › Linked Devices › Link with phone number.",
                            color = Tokens.TextMut,
                            fontFamily = InterFamily,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        BondhuField(s.phone, vm::onPhone, "Phone number (with country code)")
                        Spacer(Modifier.height(12.dp))
                        BondhuButton("Get pairing code", vm::requestPairingCode, Modifier.fillMaxWidth())
                        Spacer(Modifier.height(24.dp))

                        if (!s.pairingCode.isNullOrEmpty()) {
                            Text(
                                "YOUR PAIRING CODE",
                                color = Tokens.TextMut,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                fontFamily = InterFamily,
                                letterSpacing = 1.5.sp,
                            )
                            Spacer(Modifier.height(12.dp))
                            // Each character in its own glassy box
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                s.pairingCode!!.replace("-", "").forEach { ch ->
                                    Surface(
                                        color = Tokens.Field,
                                        shape = DigitShape,
                                        modifier = Modifier
                                            .size(40.dp)
                                            .border(1.dp, Tokens.Divider, DigitShape),
                                    ) {
                                        Box(
                                            contentAlignment = Alignment.Center,
                                            modifier = Modifier.fillMaxSize(),
                                        ) {
                                            Text(
                                                ch.toString(),
                                                color = Tokens.Primary,
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = InterFamily,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(4.dp))
                }
            }
        }
    }
}
