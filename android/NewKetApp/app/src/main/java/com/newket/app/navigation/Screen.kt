package com.newket.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    // Auth screens
    object Login : Screen("login")
    object Register : Screen("register")

    // Main screens (behind bottom nav)
    object Catalogue : Screen("catalogue")
    object Cart : Screen("cart")
    object Favorites : Screen("favorites")
    object Profile : Screen("profile")
    object ProductDetail : Screen("product/{productId}") {
        fun createRoute(productId: Int) = "product/$productId"
    }
}

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Catalogue, "Catalogue", Icons.Filled.Home),
    BottomNavItem(Screen.Favorites, "Favoris", Icons.Filled.Favorite),
    BottomNavItem(Screen.Cart, "Panier", Icons.Filled.ShoppingCart),
    BottomNavItem(Screen.Profile, "Profil", Icons.Filled.Person),
)
