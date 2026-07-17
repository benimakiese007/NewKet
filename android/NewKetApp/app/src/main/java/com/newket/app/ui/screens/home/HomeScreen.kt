package com.newket.app.ui.screens.home

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.basicMarquee
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.newket.app.data.model.Product
import com.newket.app.ui.screens.catalogue.CatalogueViewModel
import com.newket.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onProductClick: (String) -> Unit,
    viewModel: CatalogueViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        AsyncImage(
                            model = com.newket.app.R.drawable.logo_header,
                            contentDescription = "NewKet Logo",
                            modifier = Modifier.height(32.dp),
                            contentScale = ContentScale.Fit
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { /* TODO: Open drawer or menu */ }) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Menu",
                            tint = Color.Black
                        )
                    }
                },
                actions = {
                    // Spacer to balance the title so it's perfectly centered
                    Spacer(modifier = Modifier.width(48.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Color.White
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color.White)
                .verticalScroll(scrollState)
        ) {
        // ─── HERO SECTION ─────────────────────────────────────────────────────
        HeroSection()

        // ─── MARQUEE FEATURES BAR ─────────────────────────────────────────────
        MarqueeSection()

        // ─── FILTER CHIPS ─────────────────────────────────────────────────────
        val categories = listOf("Toutes les pièces", "Femme", "Homme", "Tech & Gadgets", "Art de vivre", "Promos")
        var selectedCategory by remember { mutableStateOf("Toutes les pièces") }

        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Tous les produits",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 20.sp,
                    color = Color(0xFF111827)
                )
            }

            Spacer(Modifier.height(12.dp))
        }

        // Category filter scrollable row
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            categories.forEach { cat ->
                val isActive = cat == selectedCategory
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isActive) Color(0xFF111827) else Color(0xFFF3F4F6))
                        .clickable { selectedCategory = cat }
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(
                        cat,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isActive) Color.White else Color(0xFF374151)
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // ─── PRODUCT GRID ─────────────────────────────────────────────────────
        if (state.isLoading) {
            // Skeleton loading grid
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                for (row in 0..2) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        repeat(2) {
                            SkeletonCard(modifier = Modifier.weight(1f))
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }
        } else {
            val filteredProducts = when (selectedCategory) {
                "Femme" -> state.products.filter { it.category?.contains("Femme", true) == true }
                "Homme" -> state.products.filter { it.category?.contains("Homme", true) == true }
                "Tech & Gadgets" -> state.products.filter { it.category?.contains("Tech", true) == true }
                "Art de vivre" -> state.products.filter { it.category?.contains("Art", true) == true }
                "Promos" -> state.products.filter { it.isPromo }
                else -> state.products
            }

            if (filteredProducts.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Aucun produit trouvé.", fontSize = 14.sp, color = Color(0xFF9CA3AF))
                }
            } else {
                // 2-column grid
                val chunked = filteredProducts.chunked(2)
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    chunked.forEach { rowProducts ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowProducts.forEach { product ->
                                ProductCard(
                                    product = product,
                                    onClick = { onProductClick(product.id) },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            // If odd number, fill remaining space
                            if (rowProducts.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                    }
                }
            }
        }

        Spacer(Modifier.height(100.dp)) // Bottom nav padding
    }
}
}

@Composable
private fun HeroSection() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(24.dp))
            .shadow(elevation = 16.dp, shape = RoundedCornerShape(24.dp))
            .background(Color.Black)
            .height(280.dp)
    ) {
        // Dark overlay gradient
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0x99000000),
                            Color(0xCC000000)
                        )
                    )
                )
        )

        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "SUBTILE",
                fontSize = 48.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = (-2).sp,
                lineHeight = 44.sp
            )
            Text(
                text = "ÉLÉGANCE.",
                fontSize = 48.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFFD1D5DB),
                letterSpacing = (-2).sp,
                lineHeight = 44.sp
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "L'excellence du luxe à portée de main.",
                fontSize = 14.sp,
                color = Color(0xE6FFFFFF),
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.height(20.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White)
                    .clickable { }
                    .padding(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Text(
                    "DÉCOUVRIR LA COLLECTION",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.Black,
                    letterSpacing = 2.sp
                )
            }
        }

        // Promo badge top right
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(20.dp)
                .size(72.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0x1AFFFFFF))
                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("-50%", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color.White)
                Text("PROMO", fontSize = 7.sp, fontWeight = FontWeight.Bold, color = Color(0x99FFFFFF), letterSpacing = 1.sp)
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MarqueeSection() {
    val features = listOf(
        "Livraison Rapide" to "Dès 125 000 FC d'achat",
        "Paiement Sécurisé" to "Transactions 100% cryptées",
        "Paiement Mobile" to "M-Pesa, Orange, Airtel",
        "Livraison Rapide" to "Dès 125 000 FC d'achat",
        "Paiement Sécurisé" to "Transactions 100% cryptées",
        "Paiement Mobile" to "M-Pesa, Orange, Airtel",
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp)
            .background(Color.White)
    ) {
        HorizontalDivider(color = Color(0xFFF1F5F9), thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
                .basicMarquee(
                    iterations = Int.MAX_VALUE,
                    velocity = 30.dp
                ),
            horizontalArrangement = Arrangement.spacedBy(40.dp)
        ) {
            features.forEach { (title, sub) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(horizontal = 16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF111827))
                    )
                    Column {
                        Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Black, letterSpacing = 1.5.sp)
                        Text(sub, fontSize = 10.sp, color = Color(0xFF6B7280), fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
        HorizontalDivider(modifier = Modifier.align(Alignment.BottomCenter), color = Color(0xFFF1F5F9), thickness = 1.dp)
    }
}

@Composable
private fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.clickable(onClick = onClick)
    ) {
        // Product image
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFF9FAFB))
                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(12.dp))
        ) {
            if (!product.image.isNullOrBlank()) {
                AsyncImage(
                    model = product.image.split(",").firstOrNull()?.trim(),
                    contentDescription = product.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Icon(
                    Icons.Filled.ShoppingCart,
                    contentDescription = null,
                    tint = Color(0xFFD1D5DB),
                    modifier = Modifier
                        .size(32.dp)
                        .align(Alignment.Center)
                )
            }

            // Badges
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (product.isNew) {
                    BadgeChip("Nouveau", Color.Black, Color.White)
                }
                if (product.isPromo) {
                    BadgeChip("Promo", Color(0xFFEF4444), Color.White)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Category tag
        if (!product.category.isNullOrBlank()) {
            Text(
                product.category!!,
                fontSize = 10.sp,
                color = Color(0xFF6B7280),
                fontWeight = FontWeight.Medium
            )
        }

        // Product name
        Text(
            product.name,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = Color(0xFF111827),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 18.sp
        )

        Spacer(Modifier.height(4.dp))

        // Price row
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "${formatPrice(product.price)} FC",
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = Color(0xFF111827)
            )
            if (product.oldPrice != null && product.oldPrice > product.price) {
                Text(
                    "${formatPrice(product.oldPrice)} FC",
                    fontSize = 11.sp,
                    color = Color(0xFF9CA3AF),
                    fontWeight = FontWeight.Normal,
                    style = androidx.compose.ui.text.TextStyle(
                        textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough
                    )
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        // Add to cart button
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF111827))
                .clickable { }
                .padding(vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "Ajouter au panier",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun BadgeChip(label: String, bg: Color, textColor: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

@Composable
private fun SkeletonCard(modifier: Modifier = Modifier) {
    val shimmerColors = listOf(Color(0xFFF3F4F6), Color(0xFFE5E7EB), Color(0xFFF3F4F6))
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(tween(1200, easing = FastOutSlowInEasing)),
        label = "shimmerFloat"
    )
    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 200, 0f),
        end = Offset(translateAnim, 0f)
    )

    Column(modifier = modifier) {
        Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(brush))
        Spacer(Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth(0.4f).height(10.dp).clip(RoundedCornerShape(4.dp)).background(brush))
        Spacer(Modifier.height(6.dp))
        Box(modifier = Modifier.fillMaxWidth(0.8f).height(12.dp).clip(RoundedCornerShape(4.dp)).background(brush))
        Spacer(Modifier.height(6.dp))
        Box(modifier = Modifier.fillMaxWidth(0.5f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(brush))
        Spacer(Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth().height(34.dp).clip(RoundedCornerShape(10.dp)).background(brush))
    }
}

private fun formatPrice(price: Double): String {
    return String.format("%,.0f", price).replace(",", " ")
}
