package com.newket.app.ui.screens.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.local.SessionManager
import com.newket.app.data.model.CartItem
import com.newket.app.data.model.UpdateCartRequest
import com.newket.app.data.remote.NewKetApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CartUiState(
    val isLoading: Boolean = false,
    val items: List<CartItem> = emptyList(),
    val error: String? = null,
    val orderSuccess: Boolean = false
)

@HiltViewModel
class CartViewModel @Inject constructor(
    private val api: NewKetApiService,
    private val session: SessionManager
) : ViewModel() {

    private val _state = MutableStateFlow(CartUiState())
    val state: StateFlow<CartUiState> = _state

    val total: Double get() = _state.value.items.sumOf {
        (it.product?.price ?: 0.0) * it.quantity
    }

    init {
        loadCart()
    }

    fun loadCart() {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            _state.value = CartUiState(isLoading = true)
            try {
                val response = api.getCart(session.getBearerToken(token))
                if (response.isSuccessful) {
                    _state.value = CartUiState(items = response.body() ?: emptyList())
                }
            } catch (e: Exception) {
                _state.value = CartUiState(error = "Impossible de charger le panier")
            }
        }
    }

    fun removeItem(itemId: Int) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                api.removeFromCart(session.getBearerToken(token), itemId)
                _state.value = _state.value.copy(
                    items = _state.value.items.filter { it.id != itemId }
                )
            } catch (e: Exception) { /* ignore */ }
        }
    }

    fun updateQuantity(itemId: Int, quantity: Int) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                if (quantity <= 0) {
                    removeItem(itemId)
                    return@launch
                }
                api.updateCartItem(session.getBearerToken(token), itemId, UpdateCartRequest(quantity))
                _state.value = _state.value.copy(
                    items = _state.value.items.map {
                        if (it.id == itemId) it.copy(quantity = quantity) else it
                    }
                )
            } catch (e: Exception) { /* ignore */ }
        }
    }
}
