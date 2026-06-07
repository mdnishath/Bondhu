package com.bondhu.app.ui.nav

import androidx.compose.runtime.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.bondhu.app.ui.auth.AuthScreen

@Composable
fun BondhuNavHost(gateVm: GateViewModel = hiltViewModel()) {
    val nav = rememberNavController()
    val start by gateVm.start.collectAsState()

    if (start == null) return // splash: deciding

    NavHost(navController = nav, startDestination = start!!) {
        composable(Routes.AUTH) {
            AuthScreen(onAuthed = {
                nav.navigate(Routes.ACCOUNTS) { popUpTo(Routes.AUTH) { inclusive = true } }
            })
        }
        composable(Routes.ACCOUNTS) {
            // Replaced in Task 11
            com.bondhu.app.ui.common.EmptyState("Accounts — coming in Task 11")
        }
        composable(Routes.CHAT_LIST) {
            // Replaced in Task 12
            com.bondhu.app.ui.common.EmptyState("Chats — coming in Task 12")
        }
    }
}
