package com.newket.app.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.newket.app.data.local.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val session: SessionManager
) : ViewModel() {

    // Rôle de l'utilisateur — "buyer" (acheteur) ou "supplier" (vendeur)
    val role: StateFlow<String> = session.role
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "buyer")

    // Nom de l'utilisateur
    val userName: StateFlow<String> = session.user
        .map { it?.name ?: "Mon Compte" }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "Mon Compte")

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            session.clearSession()
            onDone()
        }
    }
}
