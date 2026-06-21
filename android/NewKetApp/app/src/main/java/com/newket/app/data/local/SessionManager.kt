package com.newket.app.data.local

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.newket.app.data.model.User
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionManager @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val KEY_TOKEN = stringPreferencesKey("auth_token")
        private val KEY_USER = stringPreferencesKey("user_data")
        private val KEY_USER_ID = intPreferencesKey("user_id")
    }

    private val gson = Gson()

    val token: Flow<String?> = dataStore.data.map { it[KEY_TOKEN] }
    val userId: Flow<Int?> = dataStore.data.map { it[KEY_USER_ID] }
    val user: Flow<User?> = dataStore.data.map { prefs ->
        prefs[KEY_USER]?.let { gson.fromJson(it, User::class.java) }
    }

    suspend fun saveSession(token: String, user: User) {
        dataStore.edit { prefs ->
            prefs[KEY_TOKEN] = token
            prefs[KEY_USER] = gson.toJson(user)
            prefs[KEY_USER_ID] = user.id
        }
    }

    suspend fun clearSession() {
        dataStore.edit { it.clear() }
    }

    fun getBearerToken(token: String) = "Bearer $token"
}
