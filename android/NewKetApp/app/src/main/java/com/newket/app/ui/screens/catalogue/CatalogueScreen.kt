package com.newket.app.ui.screens.catalogue

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage

// ─── Catégories (identiques au site web) ──────────────────────────────────────
val CATEGORIES = listOf("Toutes les pièces", "Femme", "Homme", "Tech & Gadgets", "Art de vivre", "Promos")

@Composable
fun CatalogueScreen(
    onProductClick: (String) -> Unit,
    viewModel: CatalogueViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Toutes les pièces") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // ── Sticky Top Bar ─────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 16.dp)
                .padding(top = 16.dp, bottom = 8.dp)
        ) {
            Text(
                text = "Catalogue",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF111827),
                letterSpacing = (-0.5).sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Search bar — web style
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFF9FAFB))
                    .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp))
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(20.dp))
                BasicTextField(
                    value = searchQuery,
                    onValueChange = {
                        searchQuery = it
                        viewModel.search(it, selectedCategory)
                    },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 14.sp,
                        color = Color(0xFF111827),
                        fontWeight = FontWeight.Medium
                    ),
                    decorationBox = { innerTextField ->
                        if (searchQuery.isEmpty()) {
                            Text("Rechercher un article...", fontSize = 14.sp, color = Color(0xFF9CA3AF))
                        }
                        innerTextField()
                    }
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Category chips
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(CATEGORIES) { category ->
                    CategoryChip(
                        label = category,
                        selected = selectedCategory == category,
                        onClick = {
                            selectedCategory = category
                            viewModel.search(searchQuery, category)
                        }
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        HorizontalDivider(color = Color(0xFFF1F5F9), thickness = 1.dp)

        // ── Product Grid ───────────────────────────────────────────────────
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFF111827), strokeWidth = 2.dp)
                }
            }
            state.products.isEmpty() -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = Color(0xFFD1D5DB),
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "Aucun produit trouvé",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF9CA3AF)
                        )
                    }
                }
            }
            else -> {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(state.products) { product ->
                        CatalogueProductCard(
                            product = product,
                            onClick = { onProductClick(product.id) },
                            onFavorite = { viewModel.toggleFavorite(product.id) }
                        )
                    }
                }
            }
        }
    }
}

// ─── Category Chip ─────────────────────────────────────────────────────────────
@Composable
fun CategoryChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFF111827) else Color(0xFFF3F4F6))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) Color.White else Color(0xFF374151),
            letterSpacing = 0.3.sp
        )
    }
}

// ─── Product Card — pixel-perfect match with web ──────────────────────────────
@Composable
fun CatalogueProductCard(
    product: com.newket.app.data.model.Product,
    onClick: () -> Unit,
    onFavorite: () -> Unit
) {
    var isFav by remember { mutableStateOf(product.isFavorite) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        // Image
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.9f)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFFF9FAFB))
                .border(1.dp, Color(0xFFF1F5F9), RoundedCornerShape(16.dp))
        ) {
            AsyncImage(
                model = product.image?.split(",")?.firstOrNull()?.trim(),
                contentDescription = product.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Badges top-left
            Row(
                modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                if (product.isNew) {
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color.Black).padding(horizontal = 6.dp, vertical = 2.dp)
                    ) { Text("Nouveau", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White) }
                }
                if (product.isPromo) {
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0xFFEF4444)).padding(horizontal = 6.dp, vertical = 2.dp)
                    ) { Text("Promo", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color.White) }
                }
            }

            // Favorite button top-right
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.92f))
                    .clickable {
                        isFav = !isFav
                        onFavorite()
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isFav) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = "Favori",
                    tint = if (isFav) Color(0xFFEF4444) else Color(0xFFD1D5DB),
                    modifier = Modifier.size(15.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Category
        if (!product.category.isNullOrBlank()) {
            Text(
                text = product.category!!,
                fontSize = 10.sp,
                color = Color(0xFF6B7280),
                fontWeight = FontWeight.Medium
            )
        }

        // Name
        Text(
            text = product.name,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF111827),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 18.sp
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Price row
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = "${formatCatalogPrice(product.price)} FC",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF111827)
            )
            if (product.oldPrice != null && product.oldPrice > product.price) {
                Text(
                    text = "${formatCatalogPrice(product.oldPrice)} FC",
                    fontSize = 11.sp,
                    color = Color(0xFF9CA3AF),
                    textDecoration = TextDecoration.LineThrough
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

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

// ─── Legacy ProductCard kept for backward compatibility ────────────────────────
@Composable
fun ProductCard(
    product: com.newket.app.data.model.Product,
    onClick: () -> Unit,
    onFavorite: () -> Unit
) {
    CatalogueProductCard(product = product, onClick = onClick, onFavorite = onFavorite)
}

private fun formatCatalogPrice(price: Double): String {
    return String.format("%,.0f", price).replace(",", " ")
}
