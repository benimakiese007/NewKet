package com.newket.app.ui.screens.product

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    onBack: () -> Unit,
    onAddToCart: () -> Unit,
    viewModel: ProductDetailViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    var quantity by remember { mutableStateOf(1) }
    var isFavorite by remember { mutableStateOf(false) }

    LaunchedEffect(productId) {
        viewModel.loadProduct(productId)
    }

    Scaffold(
        containerColor = Color(0xFFF9FAFB),
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White)
                                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Retour",
                                tint = Color(0xFF111827),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { isFavorite = !isFavorite }) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White)
                                .border(1.dp, if (isFavorite) Color(0xFFFEE2E2) else Color(0xFFF1F5F9), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                                contentDescription = "Favoris",
                                tint = if (isFavorite) Color(0xFFEF4444) else Color(0xFFD1D5DB),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFF9FAFB))
            )
        },
        bottomBar = {
            state.product?.let { product ->
                // Bottom Action Bar
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                            .navigationBarsPadding(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Quantity selector
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color.White)
                                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(14.dp))
                                .padding(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { if (quantity > 1) quantity-- },
                                contentAlignment = Alignment.Center
                            ) {
                                Text("-", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF6B7280))
                            }
                            Text(
                                "$quantity",
                                modifier = Modifier.padding(horizontal = 12.dp),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF111827)
                            )
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { quantity++ },
                                contentAlignment = Alignment.Center
                            ) {
                                Text("+", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF6B7280))
                            }
                        }

                        // Add to cart button
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(52.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF16A34A))
                                .clickable {
                                    viewModel.addToCart(product.id, quantity)
                                    onAddToCart()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Filled.ShoppingCart, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                                Text(
                                    "AJOUTER AU PANIER",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    letterSpacing = 1.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        val product = state.product

        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF111827), strokeWidth = 2.dp)
            }
        } else if (product == null) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                Text("Produit introuvable", color = Color(0xFF9CA3AF))
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
            ) {
                // ─── Product Image ────────────────────────────────────────────
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color.White)
                        .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(24.dp))
                        .shadow(4.dp, RoundedCornerShape(24.dp))
                ) {
                    val images = product.image?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
                    if (images.isNotEmpty()) {
                        AsyncImage(
                            model = images.first(),
                            contentDescription = product.name,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(8.dp)
                        )
                    } else {
                        Icon(
                            Icons.Filled.ShoppingCart,
                            contentDescription = null,
                            tint = Color(0xFFD1D5DB),
                            modifier = Modifier.size(80.dp).align(Alignment.Center)
                        )
                    }

                    // Badges in top-left corner
                    Row(
                        modifier = Modifier.align(Alignment.TopStart).padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (product.isNew) {
                            Box(
                                modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color.Black).padding(horizontal = 8.dp, vertical = 3.dp)
                            ) { Text("Nouveau", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White) }
                        }
                        if (product.isPromo) {
                            Box(
                                modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0xFFEF4444)).padding(horizontal = 8.dp, vertical = 3.dp)
                            ) { Text("Promo", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White) }
                        }
                    }
                }

                // ─── Product Details ──────────────────────────────────────────
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {

                    // Category
                    if (!product.category.isNullOrBlank()) {
                        Text(
                            product.category!!.uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF9CA3AF),
                            letterSpacing = 2.sp
                        )
                        Spacer(Modifier.height(6.dp))
                    }

                    // Product name
                    Text(
                        product.name,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFF111827),
                        lineHeight = 30.sp
                    )

                    Spacer(Modifier.height(12.dp))

                    // Price row
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            "${formatPrice(product.price)} FC",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF111827)
                        )
                        if (product.oldPrice != null && product.oldPrice > product.price) {
                            Text(
                                "${formatPrice(product.oldPrice)} FC",
                                fontSize = 14.sp,
                                color = Color(0xFF9CA3AF),
                                textDecoration = TextDecoration.LineThrough
                            )
                            // Discount percentage badge
                            val discount = ((product.oldPrice - product.price) / product.oldPrice * 100).toInt()
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(Color(0xFFDCFCE7))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text("-${discount}%", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFF15803D))
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Vendor info card
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFF9FAFB))
                            .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF111827)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                product.sellerId.firstOrNull()?.uppercase() ?: "V",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("VENDU PAR", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.5.sp)
                            Text(product.sellerId, fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF111827))
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("EXPÉDITION", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.sp)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Filled.LocalShipping, contentDescription = null, tint = Color(0xFF22C55E), modifier = Modifier.size(14.dp))
                                Text("Sur devis", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF111827))
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Availability & delivery grid
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Availability
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFFF9FAFB))
                                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(14.dp))
                                .padding(14.dp)
                        ) {
                            Text("DISPONIBILITÉ", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.sp)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                if (product.stock > 0) "${product.stock} en stock" else "Épuisé",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                color = if (product.stock > 0) Color(0xFF111827) else Color(0xFFEF4444)
                            )
                        }
                        // Delivery
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFFF9FAFB))
                                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(14.dp))
                                .padding(14.dp)
                        ) {
                            Text("LIVRAISON", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF9CA3AF), letterSpacing = 1.sp)
                            Spacer(Modifier.height(8.dp))
                            Text("Sur devis", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF111827))
                            Text("Frais selon la zone", fontSize = 10.sp, color = Color(0xFF6B7280), fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // Description
                    if (product.description.isNotBlank()) {
                        Text(
                            product.description,
                            fontSize = 14.sp,
                            color = Color(0xFF6B7280),
                            fontWeight = FontWeight.Medium,
                            lineHeight = 22.sp
                        )
                        Spacer(Modifier.height(20.dp))
                    }

                    // After Order Process card
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(16.dp))
                            .padding(16.dp)
                    ) {
                        Text(
                            "APRÈS LA COMMANDE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF9CA3AF),
                            letterSpacing = 2.sp
                        )
                        Spacer(Modifier.height(12.dp))
                        val steps = listOf(
                            Icons.Filled.Email to "Demande envoyée au vendeur",
                            Icons.Filled.Receipt to "Devis de livraison (si besoin)",
                            Icons.Filled.CreditCard to "Paiement en séquestre NewKet",
                            Icons.Filled.CheckCircle to "Réception + validation OTP"
                        )
                        steps.chunked(2).forEach { rowSteps ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                rowSteps.forEach { (icon, text) ->
                                    Row(
                                        modifier = Modifier.weight(1f).padding(vertical = 4.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.Top
                                    ) {
                                        Icon(icon, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(16.dp))
                                        Text(text, fontSize = 11.sp, color = Color(0xFF374151), fontWeight = FontWeight.SemiBold, lineHeight = 16.sp)
                                    }
                                }
                                if (rowSteps.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }

                    Spacer(Modifier.height(100.dp))
                }
            }
        }
    }
}

private fun formatPrice(price: Double): String {
    return String.format("%,.0f", price).replace(",", " ")
}
