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

    val categories = listOf("Tous", "Légumes", "Fruits", "Viandes", "Poissons", "Épices", "Boissons")

    init {
        loadProducts()
    }

    fun loadProducts() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val category = if (_state.value.selectedCategory == "Tous" || _state.value.selectedCategory == null) null
                               else _state.value.selectedCategory
                val search = _state.value.searchQuery.takeIf { it.isNotBlank() }
                val response = api.getProducts(category = category, search = search)
                if (response.isSuccessful) {
                    _state.value = _state.value.copy(
                        products = response.body() ?: emptyList(),
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
}
