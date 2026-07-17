package com.newket.app.data.model

import com.google.gson.annotations.SerializedName

data class Product(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val price: Double = 0.0,
    @SerializedName("old_price")
    val oldPrice: Double? = null,
    val stock: Int = 0,
    val category: String? = null,
    @SerializedName("image")
    val image: String? = null, // Can be comma separated
    @SerializedName("supplier_email")
    val sellerId: String = "",
    @SerializedName("created_at")
    val createdAt: String = "",
    @SerializedName("is_new")
    val isNew: Boolean = false,
    @SerializedName("is_promo")
    val isPromo: Boolean = false,
    // Champ local (non-API) pour suivre les favoris
    @Transient val isFavorite: Boolean = false
)

data class User(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val role: String = "buyer",
    val phone: String? = null
)

data class CartItem(
    val id: String = "",
    @SerializedName("product_id")
    val productId: String = "",
    @SerializedName("user_id")
    val userId: String = "",
    val quantity: Int = 0,
    val product: Product? = null
)

data class Order(
    val id: String = "",
    @SerializedName("user_id")
    val userId: String = "",
    val status: String = "",
    val total: Double = 0.0,
    val items: List<OrderItem> = emptyList(),
    @SerializedName("created_at")
    val createdAt: String = ""
)

data class OrderItem(
    val id: String = "",
    @SerializedName("product_id")
    val productId: String = "",
    val quantity: Int = 0,
    val price: Double = 0.0,
    val product: Product? = null
)

data class Favorite(
    val id: String = "",
    @SerializedName("user_id")
    val userId: String = "",
    @SerializedName("product_id")
    val productId: String = "",
    val product: Product? = null
)
