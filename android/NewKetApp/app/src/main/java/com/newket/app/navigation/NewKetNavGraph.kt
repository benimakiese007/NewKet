package com.newket.app.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.newket.app.ui.screens.auth.LoginScreen
import com.newket.app.ui.screens.cart.CartScreen
import com.newket.app.ui.screens.catalogue.CatalogueScreen
import com.newket.app.ui.screens.favorites.FavoritesScreen
import com.newket.app.ui.screens.notifications.NotificationsScreen
import com.newket.app.ui.screens.product.ProductDetailScreen
import com.newket.app.ui.screens.profile.ProfileScreen
import com.newket.app.ui.theme.NewKetBlack
import com.newket.app.ui.theme.NewKetBorderLight

sealed class Screen(val route: String) {
    object Login       : Screen("login")
    object Home        : Screen("home")
    object Catalogue   : Screen("catalogue")
    object Favorites   : Screen("favorites")
    object Cart        : Screen("cart")
    object Notifications : Screen("notifications")
    object Profile     : Screen("profile")
    object ProductDetail : Screen("product/{productId}") {
        fun createRoute(id: String) = "product/$id"
    }
}

data class BottomNavItem(
    val screen: Screen,
    val icon: ImageVector,
    val label: String
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Home,           Icons.Default.Home,         "Accueil"),
    BottomNavItem(Screen.Catalogue,      Icons.Default.Search,       "Catalogue"),
    BottomNavItem(Screen.Favorites,      Icons.Default.Favorite,     "Favoris"),
    BottomNavItem(Screen.Cart,           Icons.Default.ShoppingCart,  "Panier"),
    BottomNavItem(Screen.Notifications,  Icons.Default.Notifications, "Notifs"),
    BottomNavItem(Screen.Profile,        Icons.Default.Person,        "Profil")
)

@Composable
fun NewKetNavGraph(
    startDestination: String = Screen.Login.route
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val showBottomBar = currentRoute in bottomNavItems.map { it.screen.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NewKetBottomNavBar(navController = navController, currentRoute = currentRoute)
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(innerPadding)
        ) {
            // Auth — onglets Connexion/Inscription intégrés
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onContinueAsGuest = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            // Accueil
            composable(Screen.Home.route) {
                com.newket.app.ui.screens.home.HomeScreen(
                    onProductClick = { productId ->
                        navController.navigate(Screen.ProductDetail.createRoute(productId))
                    }
                )
            }

            // Catalogue
            composable(Screen.Catalogue.route) {
                CatalogueScreen(
                    onProductClick = { productId ->
                        navController.navigate(Screen.ProductDetail.createRoute(productId))
                    }
                )
            }

            // Favoris
            composable(Screen.Favorites.route) {
                FavoritesScreen(
                    onProductClick = { productId ->
                        navController.navigate(Screen.ProductDetail.createRoute(productId))
                    }
                )
            }

            // Panier
            composable(Screen.Cart.route) {
                CartScreen()
            }

            // Notifications
            composable(Screen.Notifications.route) {
                NotificationsScreen()
            }

            // Profil (dashboard acheteur + vendeur)
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            // Détail produit
            composable(Screen.ProductDetail.route) { backStackEntry ->
                val productId = backStackEntry.arguments?.getString("productId") ?: ""
                ProductDetailScreen(
                    productId = productId,
                    onBack = { navController.popBackStack() },
                    onAddToCart = { navController.navigate(Screen.Cart.route) }
                )
            }
        }
    }
}

@Composable
fun NewKetBottomNavBar(
    navController: NavHostController,
    currentRoute: String?
) {
    Box(
        modifier = Modifier
            .background(Color.Transparent)
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(100.dp))
                .background(Color(0xFFFFFFFF).copy(alpha = 0.85f))
                .border(
                    width = 1.dp,
                    color = Color.White.copy(alpha = 0.6f),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(100.dp)
                )
                .padding(vertical = 12.dp, horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            bottomNavItems.forEach { item ->
                val selected = currentRoute == item.screen.route
                val contentColor = if (selected) NewKetBlack else Color(0xFF9CA3AF)

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable(
                            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                            indication = null
                        ) {
                            navController.navigate(item.screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(androidx.compose.foundation.shape.CircleShape)
                            .background(if (selected) Color(0xFFF3F4F6) else Color.Transparent),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = item.label,
                            tint = contentColor,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    if (selected) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .size(4.dp)
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .background(NewKetBlack)
                        )
                    }
                }
            }
        }
    }
}
