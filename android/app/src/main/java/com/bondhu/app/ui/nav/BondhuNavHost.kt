package com.bondhu.app.ui.nav

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.bondhu.app.ui.account.AccountListScreen
import com.bondhu.app.ui.account.PairScreen
import com.bondhu.app.ui.auth.AuthScreen
import com.bondhu.app.ui.settings.SettingsScreen

@Composable
fun BondhuNavHost(
    gateVm: GateViewModel = hiltViewModel(),
    pendingChatJid: String? = null,
    pendingChatName: String? = null,
    onChatConsumed: () -> Unit = {},
) {
    val nav = rememberNavController()
    val start by gateVm.start.collectAsState()

    if (start == null) return

    // Deep-link from a tapped notification: jump straight into the chat.
    LaunchedEffect(pendingChatJid, start) {
        if (pendingChatJid != null && start == Routes.CHAT_LIST) {
            nav.navigate(Routes.chat(pendingChatJid, pendingChatName ?: ""))
            onChatConsumed()
        }
    }

    NavHost(navController = nav, startDestination = start!!) {
        composable(Routes.AUTH) {
            AuthScreen(onAuthed = { nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.AUTH) { inclusive = true } } })
        }
        composable(Routes.ACCOUNTS) {
            AccountListScreen(
                onAddAccount = { accountId -> nav.navigate(Routes.pair(accountId)) },
                onOpenAccount = { nav.navigate(Routes.CHAT_LIST) { popUpTo(Routes.ACCOUNTS) } },
            )
        }
        composable(Routes.PAIR, arguments = listOf(navArgument("accountId") { type = NavType.StringType })) { entry ->
            val accountId = entry.arguments?.getString("accountId") ?: ""
            PairScreen(accountId = accountId, onConnected = {
                // Linked → go straight to chats (PairViewModel set this as active account).
                nav.navigate(Routes.CHAT_LIST) { popUpTo(Routes.ACCOUNTS) { inclusive = true } }
            })
        }
        composable(Routes.CHAT_LIST) {
            com.bondhu.app.ui.chatlist.ChatListScreen(
                onOpenChat = { jid, name, unread -> nav.navigate(Routes.chat(jid, name, unread)) },
                onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                onSwitchAccount = { nav.navigate(Routes.ACCOUNTS) },
            )
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { nav.popBackStack() },
                onLoggedOut = { nav.navigate(Routes.AUTH) { popUpTo(0) { inclusive = true } } },
            )
        }
        composable(
            Routes.CHAT,
            arguments = listOf(
                androidx.navigation.navArgument("chatId") { type = androidx.navigation.NavType.StringType },
                androidx.navigation.navArgument("name") { type = androidx.navigation.NavType.StringType; nullable = true; defaultValue = null },
                androidx.navigation.navArgument("unread") { type = androidx.navigation.NavType.IntType; defaultValue = 0 },
            ),
        ) { entry ->
            val chatId = android.net.Uri.decode(entry.arguments?.getString("chatId") ?: "")
            val name = entry.arguments?.getString("name")?.let { android.net.Uri.decode(it) }
            com.bondhu.app.ui.chat.ChatScreen(
                chatId = chatId,
                title = name?.takeIf { it.isNotBlank() } ?: ("+" + chatId.substringBefore("@")),
                unreadAtOpen = entry.arguments?.getInt("unread") ?: 0,
                onBack = { nav.popBackStack() },
            )
        }
    }
}
