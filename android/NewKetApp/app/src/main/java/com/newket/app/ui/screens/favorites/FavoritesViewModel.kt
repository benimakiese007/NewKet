package com.newket.app.ui.screens.favorites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.local.SessionManager
import com.newket.app.data.model.Favorite
import com.newket.app.data.remote.NewKetApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FavoritesUiState(
    val isLoading: Boolean = false,
    val favorites: List<Favorite> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class FavoritesViewModel @Inject constructor(
    private val api: NewKetApiService,
    private val session: SessionManager
) : ViewModel() {

    private val _state = MutableStateFlow(FavoritesUiState())
    val state: StateFlow<FavoritesUiState> = _state

    init {
        loadFavorites()
    }

    fun loadFavorites() {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            _state.value = FavoritesUiState(isLoading = true)
            try {
                val response = api.getFavorites(session.getBearerToken(token))
                if (response.isSuccessful) {
                    _state.value = FavoritesUiState(favorites = response.body() ?: emptyList())
                }
            } catch (e: Exception) {
                _state.value = FavoritesUiState(error = "Erreur de chargement")
            }
        }
    }

    fun removeFavorite(productId: Int) {
        viewModelScope.launch {
            val token = session.token.first() ?: return@launch
            try {
                api.removeFavorite(session.getBearerToken(token), productId)
                _state.value = _state.value.copy(
                    favorites = _state.value.favorites.filter { it.productId != productId }
                )
            } catch (e: Exception) { /* ignore */ }
        }
    }
}
