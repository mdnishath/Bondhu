package com.bondhu.app.ui.settings

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.bondhu.app.data.model.ApiKeyDto
import com.bondhu.app.ui.chat.LanguageSheet
import com.bondhu.app.ui.common.BondhuButton
import com.bondhu.app.ui.common.BondhuField
import com.bondhu.app.ui.theme.Tokens

private val CardShape = RoundedCornerShape(18.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLoggedOut: () -> Unit,
    vm: SettingsViewModel = hiltViewModel(),
) {
    val s by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var langSheetOpen by remember { mutableStateOf(false) }

    // Show error snackbar
    LaunchedEffect(s.error) {
        if (s.error != null) {
            snackbarHostState.showSnackbar(s.error!!)
            vm.clearError()
        }
    }
    LaunchedEffect(s.notice) {
        if (s.notice != null) {
            snackbarHostState.showSnackbar(s.notice!!)
            vm.clearNotice()
        }
    }

    Scaffold(
        containerColor = Tokens.AppBg,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Text(
                            "Settings",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 18.sp,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = Tokens.TextMain,
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Tokens.Header,
                        titleContentColor = Tokens.TextMain,
                    ),
                )
                HorizontalDivider(color = Tokens.Divider, thickness = 1.dp)
            }
        },
    ) { pad ->
        if (s.loading && s.keys.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Tokens.Primary)
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(pad)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // --- API Keys section ---
            GlassCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "API keys",
                        color = Tokens.Primary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                    )
                    if (s.keys.isEmpty()) {
                        Text("No keys added yet.", color = Tokens.TextMut, fontSize = 13.sp)
                    } else {
                        s.keys.forEach { key ->
                            KeyRow(
                                key = key,
                                onActivate = { vm.activateKey(key.id) },
                                onDelete = { vm.deleteKey(key.id) },
                            )
                            HorizontalDivider(color = Tokens.Divider, thickness = 0.5.dp)
                        }
                    }
                    // Add key form
                    BondhuField(
                        value = s.newKeyLabel,
                        onValueChange = vm::onNewKeyLabel,
                        label = "Label (optional)",
                    )
                    BondhuField(
                        value = s.newKeyValue,
                        onValueChange = vm::onNewKeyValue,
                        label = "API key value",
                    )
                    BondhuButton(
                        text = if (s.loading) "Adding…" else "Add key",
                        onClick = { vm.addKey() },
                        enabled = !s.loading,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedButton(
                        onClick = { vm.testKey() },
                        enabled = !s.testing && s.keys.isNotEmpty(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(50),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Tokens.Primary),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Tokens.Primary),
                    ) {
                        Text(if (s.testing) "Testing…" else "Test active key", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // --- Language section ---
            GlassCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Default language",
                        color = Tokens.Primary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                    )
                    val currentLang = s.supported.find { it.code == s.globalLang }
                    val display = if (currentLang != null) "${currentLang.flag}  ${currentLang.name}" else s.globalLang.ifBlank { "—" }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(display, color = Tokens.TextMain, fontSize = 15.sp)
                        TextButton(onClick = { langSheetOpen = true }) {
                            Text("Change", color = Tokens.Primary, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // --- Updates ---
            GlassCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Updates", color = Tokens.Primary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Text("Current version: ${s.currentVersion}", color = Tokens.TextMut, fontSize = 13.sp)
                    val upd = s.update
                    if (upd != null) {
                        Text("Update available: v${upd.versionName}", color = Tokens.TextMain, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        if (upd.notes.isNotBlank()) {
                            Text(upd.notes.lineSequence().take(4).joinToString("\n"), color = Tokens.TextMut, fontSize = 12.sp)
                        }
                        BondhuButton("Download & install", onClick = { vm.runUpdate() }, modifier = Modifier.fillMaxWidth())
                    } else {
                        if (s.upToDate) Text("You're on the latest version ✓", color = Tokens.TextMut, fontSize = 13.sp)
                        BondhuButton(
                            if (s.checkingUpdate) "Checking…" else "Check for updates",
                            onClick = { vm.checkUpdate() },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !s.checkingUpdate,
                        )
                    }
                }
            }

            // --- Appearance ---
            GlassCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Appearance", color = Tokens.Primary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEach { (mode, label) ->
                            FilterChip(
                                selected = s.theme == mode,
                                onClick = { vm.setTheme(mode) },
                                label = { Text(label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Tokens.Primary.copy(alpha = 0.2f),
                                    selectedLabelColor = Tokens.Primary,
                                    labelColor = Tokens.TextMut,
                                    containerColor = Tokens.Field,
                                ),
                            )
                        }
                    }
                }
            }

            // --- Account / Logout section ---
            GlassCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Account",
                        color = Tokens.Primary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                    )
                    OutlinedButton(
                        onClick = { vm.logout(onLoggedOut) },
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(50),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Tokens.Danger),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Tokens.Danger),
                    ) {
                        Text("Log out", fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }

    // Language sheet (global — no "send as typed" default row needed for global)
    LanguageSheet(
        open = langSheetOpen,
        current = s.globalLang.ifBlank { null },
        options = s.supported,
        onPick = { code -> if (code != null) vm.setLanguage(code) },
        onDismiss = { langSheetOpen = false },
    )
}

@Composable
private fun GlassCard(content: @Composable () -> Unit) {
    Surface(
        color = Tokens.Surface,
        shape = CardShape,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Tokens.Divider, CardShape),
    ) {
        content()
    }
}

@Composable
private fun KeyRow(key: ApiKeyDto, onActivate: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                key.keyMasked,
                color = Tokens.TextMain,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            if (!key.label.isNullOrBlank()) {
                Text(key.label, color = Tokens.TextMut, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.width(8.dp))
        if (key.isActive) {
            Surface(
                color = Tokens.Primary.copy(alpha = 0.15f),
                shape = RoundedCornerShape(50),
            ) {
                Text(
                    "Active",
                    color = Tokens.Primary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        } else {
            TextButton(onClick = onActivate) {
                Text("Activate", color = Tokens.Primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.width(4.dp))
        IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
            Icon(Icons.Default.Delete, contentDescription = "Delete key", tint = Tokens.Danger, modifier = Modifier.size(20.dp))
        }
    }
}
