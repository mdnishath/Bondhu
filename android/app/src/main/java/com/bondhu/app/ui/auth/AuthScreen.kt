package com.bondhu.app.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.theme.Tokens

@Composable
fun AuthScreen(onAuthed: () -> Unit, vm: AuthViewModel = hiltViewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(s.success) { if (s.success) onAuthed() }
    LaunchedEffect(s.error) { s.error?.let { snackbar.showSnackbar(it); vm.clearError() } }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, containerColor = Tokens.AppBg) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))
            Text("Bondhu", color = Tokens.TextMain, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text("Chat across languages", color = Tokens.TextMut)
            Spacer(Modifier.height(32.dp))

            TabRow(selectedTabIndex = if (s.isRegister) 1 else 0, containerColor = Tokens.Field, contentColor = Tokens.Primary) {
                Tab(selected = !s.isRegister, onClick = { if (s.isRegister) vm.toggleMode() }, text = { Text("Log in") })
                Tab(selected = s.isRegister, onClick = { if (!s.isRegister) vm.toggleMode() }, text = { Text("Create account") })
            }
            Spacer(Modifier.height(20.dp))

            if (s.isRegister) {
                BondhuField(s.name, vm::onName, "Name")
                Spacer(Modifier.height(12.dp))
            }
            BondhuField(s.email, vm::onEmail, "Email", keyboardType = KeyboardType.Email)
            Spacer(Modifier.height(12.dp))
            BondhuField(s.password, vm::onPassword, "Password", isPassword = true)
            Spacer(Modifier.height(12.dp))
            BondhuField(s.server, vm::onServer, "Server URL")
            Spacer(Modifier.height(20.dp))

            BondhuButton(
                text = if (s.loading) "Please wait…" else if (s.isRegister) "Create account" else "Log in",
                onClick = vm::submit, enabled = !s.loading, modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
            Text("By continuing you agree to Bondhu's Terms & Privacy.", color = Tokens.TextFaint, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}
