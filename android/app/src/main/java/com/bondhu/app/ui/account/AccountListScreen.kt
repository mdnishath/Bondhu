package com.bondhu.app.ui.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.Account
import com.bondhu.app.ui.common.Avatar
import com.bondhu.app.ui.common.ConnUi
import com.bondhu.app.ui.common.EmptyState
import com.bondhu.app.ui.common.StatusChip
import com.bondhu.app.ui.theme.Tokens

private fun statusToUi(status: String): ConnUi = when (status) {
    "connected" -> ConnUi.Connected
    "qr_pending" -> ConnUi.QrPending
    "pairing" -> ConnUi.Pairing
    "authenticating", "connecting" -> ConnUi.Connecting
    else -> ConnUi.Disconnected
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountListScreen(
    onAddAccount: (String) -> Unit,
    onOpenAccount: () -> Unit,
    vm: AccountViewModel = hiltViewModel(),
) {
    val s by vm.state.collectAsStateWithLifecycle()
    Scaffold(
        containerColor = Tokens.AppBg,
        topBar = { TopAppBar(title = { Text("Your accounts") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = Tokens.Header, titleContentColor = Tokens.TextMain)) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { vm.addAccount(onAddAccount) },
                containerColor = Tokens.Primary, contentColor = Tokens.OnPrimary,
                icon = { Icon(Icons.Default.Add, null) }, text = { Text("Add account") },
            )
        },
    ) { pad ->
        when {
            s.loading -> Box(Modifier.fillMaxSize().padding(pad), Alignment.Center) { CircularProgressIndicator(color = Tokens.Primary) }
            s.accounts.isEmpty() -> EmptyState("No accounts yet. Tap Add account.", Modifier.padding(pad))
            else -> LazyColumn(Modifier.fillMaxSize().padding(pad)) {
                items(s.accounts, key = { it.id }) { acc ->
                    AccountRow(acc, onClick = { vm.selectAccount(acc.id) { onOpenAccount() } })
                    HorizontalDivider(color = Tokens.Divider)
                }
            }
        }
    }
}

@Composable
private fun AccountRow(acc: Account, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(acc.label)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(acc.label, color = Tokens.TextMain, fontWeight = FontWeight.SemiBold)
            Text(acc.phone ?: "—", color = Tokens.TextMut)
        }
        StatusChip(statusToUi(acc.status))
    }
}
