package com.newket.app.ui.screens.catalogue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.model.Product
import com.newket.app.data.remote.NewKetApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CatalogueUiState(
    val isLoading: Boolean = false,
    val products: List<Product> = emptyList(),
    val error: String? = null,
    val searchQuery: String = "",
    val selectedCategory: String? = null
)

@HiltViewModel
class CatalogueViewModel @Inject constructor(
    private val api: NewKetApiService
) : ViewModel() {

    private val _state = MutableStateFlow(CatalogueUiState())
    val state: StateFlow<CatalogueUiState> = _state

    val categories = listOf("Tous", "Femme", "Homme", "Tech & Gadgets", "HIGH-TECH", "Art de vivre")

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val response = api.getProducts()
                if (response.isSuccessful) {
                    var list = response.body() ?: emptyList()
                    val cat = _state.value.selectedCategory
                    if (cat != null && cat != "Tous") {
                        list = list.filter { it.category?.equals(cat, ignoreCase = true) == true }
                    }
                    val query = _state.value.searchQuery
                    if (query.isNotBlank()) {
                        list = list.filter { it.name.contains(query, ignoreCase = true) }
                    }
                    _state.value = _state.value.copy(
                        products = list,
                        isLoading = false
                    )
                } else {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = "Impossible de charger les produits"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Vérifiez votre connexion réseau"
                )
            }
        }
    }

    fun onSearchChange(query: String) {
        _state.value = _state.value.copy(searchQuery = query)
        loadProducts()
    }

    fun onCategoryChange(category: String) {
        _state.value = _state.value.copy(
            selectedCategory = if (category == "Tous") null else category
        )
        loadProducts()
    }

    // Appelé depuis CatalogueScreen (raccourci combiné)
    fun search(query: String, category: String) {
        _state.value = _state.value.copy(
            searchQuery = query,
            selectedCategory = if (category == "Tous") null else category
        )
        loadProducts()
    }

    fun toggleFavorite(productId: String) {
        // TODO: connecter à l'API favoris
        val updated = _state.value.products.map { p ->
            if (p.id == productId) p.copy(isFavorite = !p.isFavorite) else p
        }
        _state.value = _state.value.copy(products = updated)
    }
}
