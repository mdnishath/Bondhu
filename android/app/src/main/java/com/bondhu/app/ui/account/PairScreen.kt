package com.bondhu.app.ui.account

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.common.QrImage
import com.bondhu.app.ui.theme.Tokens

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairScreen(accountId: String, onConnected: () -> Unit, vm: PairViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(0) }
    LaunchedEffect(accountId) { vm.bind(accountId) }
    LaunchedEffect(s.connected) { if (s.connected) onConnected() }

    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Link a device") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        bottomBar = {
            Surface(color = Tokens.Header) {
                Text(
                    when (s.state) { "connected" -> "Connected"; "qr_pending" -> "Waiting for you to scan…"; "pairing" -> "Enter the code in WhatsApp"; else -> s.state },
                    color = Tokens.TextMut, modifier = Modifier.fillMaxWidth().padding(16.dp), textAlign = TextAlign.Center,
                )
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            TabRow(selectedTabIndex = tab, containerColor = Tokens.Field, contentColor = Tokens.Primary) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("QR code") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Pairing code") })
            }
            Spacer(Modifier.height(24.dp))
            if (tab == 0) {
                if (s.qr.isNullOrEmpty()) {
                    CircularProgressIndicator(color = Tokens.Primary)
                    Spacer(Modifier.height(12.dp)); Text("Generating QR…", color = Tokens.TextMut)
                } else {
                    Surface(color = androidx.compose.ui.graphics.Color.White, shape = MaterialTheme.shapes.medium) {
                        QrImage(s.qr!!, Modifier.size(240.dp).padding(12.dp))
                    }
                    Spacer(Modifier.height(12.dp))
                    Text("WhatsApp › Linked Devices › Link a device", color = Tokens.TextMut, textAlign = TextAlign.Center)
                }
            } else {
                Text("Enter the number to link, then type this code in WhatsApp › Linked Devices › Link with phone number.", color = Tokens.TextMut, textAlign = TextAlign.Center)
                Spacer(Modifier.height(16.dp))
                BondhuField(s.phone, vm::onPhone, "Phone number (with country code)")
                Spacer(Modifier.height(12.dp))
                BondhuButton("Get pairing code", vm::requestPairingCode, Modifier.fillMaxWidth())
                Spacer(Modifier.height(24.dp))
                if (!s.pairingCode.isNullOrEmpty()) {
                    Text("YOUR PAIRING CODE", color = Tokens.TextMut, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(s.pairingCode!!, color = Tokens.TextMain, fontSize = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
                }
            }
        }
    }
}
