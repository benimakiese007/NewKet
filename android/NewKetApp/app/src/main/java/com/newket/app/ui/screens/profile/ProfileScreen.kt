package com.newket.app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.newket.app.ui.theme.*

// ─── Onglets Acheteur ────────────────────────────────────────────────────────
enum class CustomerTab(val label: String, val icon: ImageVector) {
    DASHBOARD("Accueil",        Icons.Default.Home),
    ORDERS   ("Mes demandes",   Icons.Default.ShoppingBag),
    PURCHASES("Mes achats",     Icons.Default.LocalMall),
    FAVORITES("Mes Favoris",    Icons.Default.Favorite),
    NOTIFS   ("Notifications",  Icons.Default.Notifications),
    SETTINGS ("Paramètres",     Icons.Default.Settings)
}

// ─── Onglets Vendeur ─────────────────────────────────────────────────────────
enum class VendorTab(val label: String, val icon: ImageVector) {
    DASHBOARD ("Tableau de bord",  Icons.Default.Dashboard),
    ANALYTICS ("Analyses & Stats", Icons.Default.BarChart),
    PUBLISH   ("Publier",          Icons.Default.AddBox),
    PRODUCTS  ("Mes Produits",     Icons.Default.Inventory),
    LEADS     ("Demandes clients", Icons.Default.Forum),
    PURCHASES ("Mes Achats",       Icons.Default.LocalMall),
    PROMOS    ("Codes promo",      Icons.Default.LocalOffer),
    SETTINGS  ("Paramètres",       Icons.Default.Settings)
}

@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val userRole by viewModel.role.collectAsState(initial = "buyer")
    val userName by viewModel.userName.collectAsState(initial = "Mon Compte")

    val isSupplier = userRole == "supplier"

    var customerTab by remember { mutableStateOf(CustomerTab.DASHBOARD) }
    var vendorTab   by remember { mutableStateOf(VendorTab.DASHBOARD) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
    ) {
        // ── Header : avatar + nom + badge rôle ───────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar avec initiale
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(if (isSupplier) NewKetBlack else NewKetInputBg)
                        .border(1.dp, NewKetBorder, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = userName.firstOrNull()?.uppercaseChar()?.toString() ?: "?",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isSupplier) Color.White else NewKetTextSecond
                    )
                }
                Column {
                    Text(
                        text = userName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = NewKetTextPrimary
                    )
                    // Badge rôle fixe — choisi à la création du compte
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (isSupplier) NewKetBlack else NewKetInputBg)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = if (isSupplier) "VENDEUR" else "ACHETEUR",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = if (isSupplier) Color.White else NewKetTextSecond,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }
        }

        HorizontalDivider(color = NewKetBorderLight)

        Row(modifier = Modifier.fillMaxSize()) {
            // ── Sidebar (icônes à gauche) ─────────────────────────────────
            Column(
                modifier = Modifier
                    .width(64.dp)
                    .fillMaxHeight()
                    .background(Color.White),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                if (!isSupplier) {
                    CustomerTab.entries.forEach { tab ->
                        SidebarIcon(
                            icon = tab.icon,
                            label = tab.label,
                            selected = customerTab == tab,
                            onClick = { customerTab = tab }
                        )
                    }
                } else {
                    VendorTab.entries.forEach { tab ->
                        SidebarIcon(
                            icon = tab.icon,
                            label = tab.label,
                            selected = vendorTab == tab,
                            onClick = { vendorTab = tab }
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Bouton déconnexion
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.logout(onLogout) }
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(
                        Icons.Default.Logout,
                        contentDescription = "Déconnexion",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        "Quitter",
                        fontSize = 7.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFEF4444)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            VerticalDivider(color = NewKetBorderLight)

            // ── Contenu principal ──────────────────────────────────────────
            Box(modifier = Modifier.fillMaxSize().background(Color(0xFFF8FAFC))) {
                val scroll = rememberScrollState()
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scroll)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (!isSupplier) {
                        when (customerTab) {
                            CustomerTab.DASHBOARD  -> CustomerHomeTab()
                            CustomerTab.ORDERS     -> CustomerOrdersTab()
                            CustomerTab.PURCHASES  -> CustomerPurchasesTab()
                            CustomerTab.FAVORITES  -> CustomerFavoritesTab()
                            CustomerTab.NOTIFS     -> CustomerNotifsTab()
                            CustomerTab.SETTINGS   -> CustomerSettingsTab(userName)
                        }
                    } else {
                        when (vendorTab) {
                            VendorTab.DASHBOARD  -> VendorHomeTab()
                            VendorTab.ANALYTICS  -> VendorAnalyticsTab()
                            VendorTab.PUBLISH    -> VendorPublishTab()
                            VendorTab.PRODUCTS   -> VendorProductsTab()
                            VendorTab.LEADS      -> VendorLeadsTab()
                            VendorTab.PURCHASES  -> VendorPurchasesTab()
                            VendorTab.PROMOS     -> VendorPromosTab()
                            VendorTab.SETTINGS   -> VendorSettingsTab(userName)
                        }
                    }
                }
            }
        }
    }
}

// ─── Sidebar icon ─────────────────────────────────────────────────────────────
@Composable
fun SidebarIcon(icon: ImageVector, label: String, selected: Boolean, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) NewKetBorderLight else Color.Transparent)
            .clickable { onClick() }
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (selected) NewKetBlack else NewKetTextLight,
            modifier = Modifier.size(20.dp)
        )
        Text(
            text = label.take(6),
            fontSize = 7.sp,
            fontWeight = if (selected) FontWeight.Black else FontWeight.Normal,
            color = if (selected) NewKetBlack else NewKetTextLight
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS ACHETEUR
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun CustomerHomeTab() {
    DashPageTitle("Accueil")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(Icons.Outlined.ChatBubbleOutline, "Demandes Shop", "0", Color(0xFFEFF6FF), modifier = Modifier.weight(1f))
        StatCard(Icons.Default.FavoriteBorder, "Favoris", "0", Color(0xFFF0FDF4), modifier = Modifier.weight(1f))
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(Icons.Outlined.Schedule, "Dernier contact", "Aujourd'hui", Color(0xFFF5F3FF), modifier = Modifier.weight(1f))
        StatCardBlack(Icons.Outlined.WorkspacePremium, "NKToken", "0 NKT", modifier = Modifier.weight(1f))
    }
    DashSectionCard("Commandes en cours") { EmptyStateSmall("Aucune commande en cours") }
    DashSectionCard("Activités récentes") { EmptyStateSmall("Aucune activité récente") }
}

@Composable
fun CustomerOrdersTab() {
    DashPageTitle("Mes demandes et devis")
    DashSectionCard("") {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OrderMockItem("Commande #1042", "En attente", "2 articles • 45,000 FCFA")
            OrderMockItem("Devis #1041", "Validé", "Sur mesure • 120,000 FCFA", isDevis = true)
        }
    }
}

@Composable
fun OrderMockItem(title: String, status: String, desc: String, isDevis: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF9FAFB))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)).background(if (isDevis) Color(0xFFEFF6FF) else Color(0xFFF0FDF4)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isDevis) Icons.Outlined.Description else Icons.Outlined.Inventory2,
                contentDescription = null,
                tint = if (isDevis) Color(0xFF3B82F6) else Color(0xFF10B981)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, color = NewKetTextPrimary, fontSize = 14.sp)
            Text(desc, color = NewKetTextSecond, fontSize = 12.sp)
        }
        Text(status, fontSize = 10.sp, fontWeight = FontWeight.Black, color = if (status == "En attente") Color(0xFFF59E0B) else Color(0xFF10B981))
    }
}

@Composable
fun CustomerPurchasesTab() {
    DashPageTitle("Mes Achats")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("Tout", "Payé", "Terminé").forEach { f ->
            FilterChipSmall(f, f == "Tout") {}
        }
    }
    DashSectionCard("Total dépensé : 0 FC") { EmptyStateSmall("Aucun achat pour le moment") }
}

@Composable
fun CustomerFavoritesTab() {
    DashPageTitle("Mes produits favoris")
    DashSectionCard("") { EmptyStateSmall("Aucun favori pour le moment") }
}

@Composable
fun CustomerNotifsTab() {
    DashPageTitle("Mes Notifications")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        TextButton(onClick = {}) {
            Text("TOUT LIRE", fontSize = 9.sp, fontWeight = FontWeight.Black,
                color = NewKetTextSecond, letterSpacing = 1.sp)
        }
        TextButton(onClick = {}) {
            Text("EFFACER", fontSize = 9.sp, fontWeight = FontWeight.Black,
                color = NewKetError, letterSpacing = 1.sp)
        }
    }
    DashSectionCard("") { EmptyStateSmall("Aucune notification") }
}

@Composable
fun CustomerSettingsTab(userName: String) {
    DashPageTitle("Mon Profil")
    DashSectionCard("Informations") {
        SettingsRow("Nom", userName)
        SettingsRow("Rôle", "Acheteur")
    }
    DashSectionCard("Sécurité") {
        SettingsRow("Mot de passe", "Modifier →")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS VENDEUR
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun VendorHomeTab() {
    DashPageTitle("Tableau de bord")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(Icons.Outlined.ChatBubbleOutline, "Demandes", "0", Color(0xFFEFF6FF), modifier = Modifier.weight(1f))
        StatCard(Icons.Outlined.Inventory2, "Produits", "0", Color(0xFFF0FDF4), modifier = Modifier.weight(1f))
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(Icons.Outlined.MonetizationOn, "Chiffre d'affaires", "0 FC", Color(0xFFFFFBEB), modifier = Modifier.weight(1f))
        StatCardBlack(Icons.Default.Star, "Note moy.", "—", modifier = Modifier.weight(1f))
    }
    DashSectionCard("Demandes récentes") { EmptyStateSmall("Aucune demande récente") }
    DashSectionCard("Activités récentes") { EmptyStateSmall("Aucune activité récente") }
}

@Composable
fun VendorAnalyticsTab() {
    DashPageTitle("Analyses & Stats")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        StatCard(Icons.Outlined.Visibility, "Vues", "0", Color(0xFFEFF6FF), modifier = Modifier.weight(1f))
        StatCard(Icons.Outlined.Mail, "Contacts", "0", Color(0xFFF0FDF4), modifier = Modifier.weight(1f))
    }
    DashSectionCard("Performances ce mois") {
        EmptyStateSmall("Données insuffisantes pour les statistiques")
    }
}

@Composable
fun VendorPublishTab() {
    DashPageTitle("Publier un article")
    var titre by remember { mutableStateOf("") }
    var categorie by remember { mutableStateOf("") }
    var prix by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    DashSectionCard("") {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            // Fake Image Picker
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFFF3F4F6))
                    .border(2.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp))
                    .clickable { },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.AddBox, contentDescription = null, modifier = Modifier.size(32.dp), tint = NewKetTextLight)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Ajouter des photos", color = NewKetTextSecond, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            NewKetFormField("Titre de l'article", titre) { titre = it }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(modifier = Modifier.weight(1f)) { NewKetFormField("Catégorie", categorie) { categorie = it } }
                Box(modifier = Modifier.weight(1f)) { NewKetFormField("Prix (FCFA)", prix) { prix = it } }
            }
            NewKetFormField("Description", description) { description = it }
            
            Button(
                onClick = {},
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NewKetBlack)
            ) {
                Text("PUBLIER L'ARTICLE", fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
fun VendorProductsTab() {
    DashPageTitle("Mes Produits")
    DashSectionCard("") { 
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ProductMockItem("Nike Air Max", "Chaussures", "45,000 FCFA")
            ProductMockItem("T-shirt Supreme", "Vêtements", "15,000 FCFA")
        }
    }
}

@Composable
fun ProductMockItem(title: String, category: String, price: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF9FAFB))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFFE5E7EB)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.Inventory2, contentDescription = null, tint = NewKetTextSecond)
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, color = NewKetTextPrimary, fontSize = 14.sp)
            Text(category, color = NewKetTextSecond, fontSize = 12.sp)
        }
        Text(price, fontSize = 12.sp, fontWeight = FontWeight.Black, color = NewKetTextPrimary)
    }
}

@Composable
fun VendorLeadsTab() {
    DashPageTitle("Demandes et devis clients")
    DashSectionCard("") { EmptyStateSmall("Aucune demande client pour le moment") }
}

@Composable
fun VendorPurchasesTab() {
    DashPageTitle("Mes Achats")
    DashSectionCard("") { EmptyStateSmall("Aucun achat pour le moment") }
}

@Composable
fun VendorPromosTab() {
    DashPageTitle("Codes promo")
    DashSectionCard("") { EmptyStateSmall("Aucun code promo actif") }
}

@Composable
fun VendorSettingsTab(userName: String) {
    DashPageTitle("Paramètres boutique")
    DashSectionCard("Ma boutique") {
        SettingsRow("Nom de la boutique", "—")
        SettingsRow("Catégorie", "—")
    }
    DashSectionCard("Mon compte") {
        SettingsRow("Nom", userName)
        SettingsRow("Rôle", "Vendeur")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants partagés
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun DashPageTitle(title: String) {
    Text(title, fontSize = 20.sp, fontWeight = FontWeight.Black,
        color = NewKetTextPrimary, letterSpacing = (-0.3).sp)
}

@Composable
fun DashSectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(0.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, NewKetBorderLight)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (title.isNotBlank()) {
                Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NewKetTextPrimary)
            }
            content()
        }
    }
}

@Composable
fun StatCard(icon: ImageVector, label: String, value: String,
             bgColor: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(0.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, NewKetBorderLight)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(bgColor),
                contentAlignment = Alignment.Center
            ) { 
                Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = NewKetBlack) 
            }
            Text(label.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black,
                color = NewKetTextLight, letterSpacing = 0.8.sp)
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = NewKetTextPrimary)
        }
    }
}

@Composable
fun StatCardBlack(icon: ImageVector, label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = NewKetBlack),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) { 
                Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color.White) 
            }
            Text(label.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black,
                color = Color.White.copy(alpha = 0.4f), letterSpacing = 0.8.sp)
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White)
        }
    }
}

@Composable
fun FilterChipSmall(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) NewKetBlack else NewKetInputBg)
            .border(1.dp, if (selected) Color.Transparent else NewKetBorder, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black,
            color = if (selected) Color.White else NewKetTextSecond, letterSpacing = 1.sp)
    }
}

@Composable
fun EmptyStateSmall(message: String) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        contentAlignment = Alignment.Center) {
        Text(message, fontSize = 12.sp, color = NewKetTextLight, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun SettingsRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = NewKetTextSecond, fontWeight = FontWeight.Medium)
        Text(value, fontSize = 13.sp, color = NewKetTextPrimary, fontWeight = FontWeight.SemiBold)
    }
    HorizontalDivider(color = NewKetBorderLight)
}

@Composable
fun NewKetFormField(label: String, value: String, onValueChange: (String) -> Unit = {}) {
    OutlinedTextField(
        value = value, onValueChange = onValueChange,
        label = {
            Text(label.uppercase(), fontSize = 9.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = NewKetBlack,
            unfocusedBorderColor = Color.Transparent,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = NewKetInputBg
        ),
        singleLine = true
    )
}
