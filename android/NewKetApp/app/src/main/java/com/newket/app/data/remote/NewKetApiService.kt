package com.newket.app.data.remote

import com.newket.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface NewKetApiService {

    // ---- Auth ----
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @GET("auth/me")
    suspend fun getMe(@Header("Authorization") token: String): Response<User>

    // ---- Products ----
    @GET("products")
    suspend fun getProducts(
        @Query("select") select: String = "*",
        @Query("order") order: String = "created_at.desc"
    ): Response<List<Product>>

    @GET("products")
    suspend fun getProduct(@Query("id") id: String, @Query("select") select: String = "*"): Response<List<Product>>

    // ---- Cart ----
    @GET("cart")
    suspend fun getCart(@Header("Authorization") token: String): Response<List<CartItem>>

    @POST("cart")
    suspend fun addToCart(
        @Header("Authorization") token: String,
        @Body request: AddToCartRequest
    ): Response<CartItem>

    @PUT("cart")
    suspend fun updateCartItem(
        @Header("Authorization") token: String,
        @Query("id") id: String,
        @Body request: UpdateCartRequest
    ): Response<CartItem>

    @DELETE("cart")
    suspend fun removeFromCart(
        @Header("Authorization") token: String,
        @Query("id") id: String
    ): Response<Unit>

    @DELETE("cart")
    suspend fun clearCart(@Header("Authorization") token: String): Response<Unit>

    // ---- Favorites ----
    @GET("favorites")
    suspend fun getFavorites(@Header("Authorization") token: String): Response<List<Favorite>>

    @POST("favorites")
    suspend fun addFavorite(
        @Header("Authorization") token: String,
        @Query("productId") productId: String
    ): Response<Favorite>

    @DELETE("favorites")
    suspend fun removeFavorite(
        @Header("Authorization") token: String,
        @Query("productId") productId: String
    ): Response<Unit>

    // ---- Orders ----
    @GET("orders")
    suspend fun getOrders(@Header("Authorization") token: String): Response<List<Order>>

    @POST("orders")
    suspend fun createOrder(
        @Header("Authorization") token: String,
        @Body request: CreateOrderRequest
    ): Response<Order>
}
