package com.newket.app.data.model

// ---- Auth ----
data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val role: String = "buyer"
)

data class AuthResponse(
    val token: String,
    val user: User
)

// ---- Generic API wrapper ----
data class ApiResponse<T>(
    val success: Boolean = true,
    val message: String = "",
    val data: T? = null
)

// ---- Cart ----
data class AddToCartRequest(
    val productId: Int,
    val quantity: Int
)

data class UpdateCartRequest(
    val quantity: Int
)

// ---- Orders ----
data class CreateOrderRequest(
    val items: List<OrderItemRequest>
)

data class OrderItemRequest(
    val productId: Int,
    val quantity: Int
)
