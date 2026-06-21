package com.newket.app.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.local.SessionManager
import com.newket.app.data.model.LoginRequest
import com.newket.app.data.model.RegisterRequest
import com.newket.app.data.remote.NewKetApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val api: NewKetApiService,
    private val session: SessionManager
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            try {
                val response = api.login(LoginRequest(email.trim(), password))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    session.saveSession(body.token, body.user)
                    _state.value = AuthUiState(isSuccess = true)
                } else {
                    _state.value = AuthUiState(error = "Email ou mot de passe incorrect")
                }
            } catch (e: Exception) {
                _state.value = AuthUiState(error = "Impossible de se connecter au serveur")
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            try {
                val response = api.register(RegisterRequest(name.trim(), email.trim(), password))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    session.saveSession(body.token, body.user)
                    _state.value = AuthUiState(isSuccess = true)
                } else {
                    _state.value = AuthUiState(error = "Erreur lors de l'inscription")
                }
            } catch (e: Exception) {
                _state.value = AuthUiState(error = "Impossible de se connecter au serveur")
            }
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }
}
