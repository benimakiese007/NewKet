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
        @Query("category") category: String? = null,
        @Query("search") search: String? = null,
        @Query("page") page: Int? = null,
        @Query("limit") limit: Int? = null
    ): Response<List<Product>>

    @GET("products/{id}")
    suspend fun getProduct(@Path("id") id: Int): Response<Product>

    // ---- Cart ----
    @GET("cart")
    suspend fun getCart(@Header("Authorization") token: String): Response<List<CartItem>>

    @POST("cart")
    suspend fun addToCart(
        @Header("Authorization") token: String,
        @Body request: AddToCartRequest
    ): Response<CartItem>

    @PUT("cart/{id}")
    suspend fun updateCartItem(
        @Header("Authorization") token: String,
        @Path("id") id: Int,
        @Body request: UpdateCartRequest
    ): Response<CartItem>

    @DELETE("cart/{id}")
    suspend fun removeFromCart(
        @Header("Authorization") token: String,
        @Path("id") id: Int
    ): Response<Unit>

    @DELETE("cart")
    suspend fun clearCart(@Header("Authorization") token: String): Response<Unit>

    // ---- Favorites ----
    @GET("favorites")
    suspend fun getFavorites(@Header("Authorization") token: String): Response<List<Favorite>>

    @POST("favorites/{productId}")
    suspend fun addFavorite(
        @Header("Authorization") token: String,
        @Path("productId") productId: Int
    ): Response<Favorite>

    @DELETE("favorites/{productId}")
    suspend fun removeFavorite(
        @Header("Authorization") token: String,
        @Path("productId") productId: Int
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
