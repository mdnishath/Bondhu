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

@Composable
fun BondhuNavHost(gateVm: GateViewModel = hiltViewModel()) {
    val nav = rememberNavController()
    val start by gateVm.start.collectAsState()

    if (start == null) return

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
                nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.ACCOUNTS) { inclusive = true } }
            })
        }
        composable(Routes.CHAT_LIST) {
            com.bondhu.app.ui.chatlist.ChatListScreen(onOpenChat = { jid -> nav.navigate(Routes.chat(jid)) })
        }
        composable(
            Routes.CHAT,
            arguments = listOf(androidx.navigation.navArgument("chatId") { type = androidx.navigation.NavType.StringType }),
        ) { entry ->
            val chatId = android.net.Uri.decode(entry.arguments?.getString("chatId") ?: "")
            com.bondhu.app.ui.chat.ChatScreen(
                chatId = chatId,
                title = "+" + chatId.substringBefore("@"),
                onBack = { nav.popBackStack() },
            )
        }
    }
}
