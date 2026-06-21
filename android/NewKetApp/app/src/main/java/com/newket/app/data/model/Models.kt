package com.newket.app.data.model

import com.google.gson.annotations.SerializedName

data class Product(
    val id: Int = 0,
    val name: String = "",
    val description: String = "",
    val price: Double = 0.0,
    val stock: Int = 0,
    val category: String = "",
    @SerializedName("image_url")
    val imageUrl: String? = null,
    @SerializedName("seller_id")
    val sellerId: Int = 0,
    @SerializedName("seller_name")
    val sellerName: String = "",
    @SerializedName("created_at")
    val createdAt: String = ""
)

data class User(
    val id: Int = 0,
    val name: String = "",
    val email: String = "",
    val role: String = "buyer",
    val phone: String? = null
)

data class CartItem(
    val id: Int = 0,
    @SerializedName("product_id")
    val productId: Int = 0,
    @SerializedName("user_id")
    val userId: Int = 0,
    val quantity: Int = 0,
    val product: Product? = null
)

data class Order(
    val id: Int = 0,
    @SerializedName("user_id")
    val userId: Int = 0,
    val status: String = "",
    val total: Double = 0.0,
    val items: List<OrderItem> = emptyList(),
    @SerializedName("created_at")
    val createdAt: String = ""
)

data class OrderItem(
    val id: Int = 0,
    @SerializedName("product_id")
    val productId: Int = 0,
    val quantity: Int = 0,
    val price: Double = 0.0,
    val product: Product? = null
)

data class Favorite(
    val id: Int = 0,
    @SerializedName("user_id")
    val userId: Int = 0,
    @SerializedName("product_id")
    val productId: Int = 0,
    val product: Product? = null
)
