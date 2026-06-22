package com.newket.app.ui.screens.product

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.local.SessionManager
import com.newket.app.data.model.AddToCartRequest
import com.newket.app.data.model.Product
import com.newket.app.data.remote.NewKetApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProductDetailUiState(
    val isLoading: Boolean = false,
    val product: Product? = null,
    val error: String? = null,
    val isFavorite: Boolean = false,
    val addedToCart: Boolean = false
)

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val api: NewKetApiService,
    private val session: SessionManager
) : ViewModel() {

    private val _state = MutableStateFlow(ProductDetailUiState())
    val state: StateFlow<ProductDetailUiState> = _state

    fun loadProduct(id: String) {
        viewModelScope.launch {
            _state.value = ProductDetailUiState(isLoading = true)
            try {
                val response = api.getProduct(id = "eq.$id")
                if (response.isSuccessful) {
                    val product = response.body()?.firstOrNull()
                    if (product != null) {
                        _state.value = ProductDetailUiState(product = product)
                        checkFavorite(id)
                    } else {
                        _state.value = ProductDetailUiState(error = "Produit introuvable")
                    }
                } else {
                    _state.value = ProductDetailUiState(error = "Produit introuvable")
                }
            } catch (e: Exception) {
                _state.value = ProductDetailUiState(error = "Erreur de connexion")
            }
        }
    }

    private fun checkFavorite(productId: String) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                val response = api.getFavorites(session.getBearerToken(token))
                if (response.isSuccessful) {
                    val isFav = response.body()?.any { it.productId == productId } == true
                    _state.value = _state.value.copy(isFavorite = isFav)
                }
            } catch (e: Exception) { /* ignore */ }
        }
    }

    fun toggleFavorite(productId: String) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                if (_state.value.isFavorite) {
                    api.removeFavorite(session.getBearerToken(token), productId)
                    _state.value = _state.value.copy(isFavorite = false)
                } else {
                    api.addFavorite(session.getBearerToken(token), productId)
                    _state.value = _state.value.copy(isFavorite = true)
                }
            } catch (e: Exception) { /* ignore */ }
        }
    }

    fun addToCart(productId: String, quantity: Int) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                api.addToCart(session.getBearerToken(token), AddToCartRequest(productId, quantity))
                _state.value = _state.value.copy(addedToCart = true)
            } catch (e: Exception) { /* ignore */ }
        }
    }
}
