package com.newket.app.ui.screens.auth

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.newket.app.ui.theme.*

// ─── Force du mot de passe ────────────────────────────────────────────────────
data class PasswordStrength(
    val score: Int,       // 0-4
    val label: String,
    val color: Color
)

fun evaluatePasswordStrength(password: String): PasswordStrength {
    if (password.isEmpty()) return PasswordStrength(0, "", Color.Transparent)
    var score = 0
    if (password.length >= 8)                              score++
    if (password.any { it.isUpperCase() })                 score++
    if (password.any { it.isDigit() })                     score++
    if (password.any { "!@#\$%^&*()_+-=[]{}|;':\",.<>?".contains(it) }) score++
    return when (score) {
        1    -> PasswordStrength(1, "Faible",      Color(0xFFEF4444))
        2    -> PasswordStrength(2, "Moyen",       Color(0xFFF59E0B))
        3    -> PasswordStrength(3, "Fort",        Color(0xFF22C55E))
        4    -> PasswordStrength(4, "Très fort",   Color(0xFF16A34A))
        else -> PasswordStrength(0, "Trop court",  Color(0xFFE5E7EB))
    }
}

@Composable
fun LoginScreen(
    onNavigateToRegister: () -> Unit = {},
    onLoginSuccess: () -> Unit,
    onContinueAsGuest: () -> Unit = {},
    viewModel: AuthViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    // Onglets
    var isLoginTab by remember { mutableStateOf(true) }

    // Connexion
    var email         by remember { mutableStateOf("") }
    var password      by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var rememberMe    by remember { mutableStateOf(false) }

    // Inscription
    var regName              by remember { mutableStateOf("") }
    var regEmail             by remember { mutableStateOf("") }
    var regPassword          by remember { mutableStateOf("") }
    var regPasswordVisible   by remember { mutableStateOf(false) }
    var regConfirm           by remember { mutableStateOf("") }
    var regConfirmVisible    by remember { mutableStateOf(false) }
    var selectedRole         by remember { mutableStateOf("customer") }

    val passwordStrength = remember(regPassword) { evaluatePasswordStrength(regPassword) }

    LaunchedEffect(state.isSuccess) {
        if (state.isSuccess) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(NewKetWhite)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 56.dp, bottom = 32.dp),
            horizontalAlignment = Alignment.Start
        ) {

            // ── Header ────────────────────────────────────────────────────────
            Text(
                text = "Bienvenue",
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                color = NewKetTextPrimary,
                letterSpacing = (-0.5).sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = if (isLoginTab) "Veuillez renseigner vos identifiants."
                       else "Créez votre compte NewKet.",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = NewKetTextSecond
            )

            Spacer(modifier = Modifier.height(32.dp))

            // ── Onglets Connexion / Inscription ───────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 0.dp),
                horizontalArrangement = Arrangement.Start
            ) {
                TabButton(
                    label = "Connexion",
                    selected = isLoginTab,
                    onClick = { isLoginTab = true; viewModel.clearError() }
                )
                Spacer(modifier = Modifier.width(24.dp))
                TabButton(
                    label = "Inscription",
                    selected = !isLoginTab,
                    onClick = { isLoginTab = false; viewModel.clearError() }
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // ── Formulaires ───────────────────────────────────────────────────
            AnimatedContent(
                targetState = isLoginTab,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "auth_form"
            ) { loginTab ->
                if (loginTab) {
                    // ══════════════════════════════════════════════════════════
                    //  CONNEXION
                    // ══════════════════════════════════════════════════════════
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

                        NewKetTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = "Adresse email",
                            keyboardType = KeyboardType.Email
                        )

                        NewKetPasswordField(
                            value = password,
                            onValueChange = { password = it },
                            label = "Mot de passe",
                            visible = passwordVisible,
                            onToggleVisibility = { passwordVisible = !passwordVisible }
                        )

                        // ── Checkbox "Se souvenir" + "Oublié ?" ────────────
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.clickable { rememberMe = !rememberMe }
                            ) {
                                Checkbox(
                                    checked = rememberMe,
                                    onCheckedChange = { rememberMe = it },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NewKetBlack,
                                        uncheckedColor = NewKetBorder,
                                        checkmarkColor = Color.White
                                    ),
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "SE SOUVENIR DE MOI",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = NewKetTextSecond,
                                    letterSpacing = 1.sp
                                )
                            }
                            Text(
                                text = "OUBLIÉ ?",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = NewKetBlack,
                                letterSpacing = 1.sp,
                                modifier = Modifier.clickable { }
                            )
                        }

                        if (state.error != null) {
                            Text(
                                text = state.error!!,
                                color = NewKetError,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        NewKetPrimaryButton(
                            label = "Se connecter",
                            isLoading = state.isLoading,
                            onClick = { viewModel.login(email, password) }
                        )
                    }

                } else {
                    // ══════════════════════════════════════════════════════════
                    //  INSCRIPTION
                    // ══════════════════════════════════════════════════════════
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {

                        // Sélecteur de rôle
                        Text(
                            text = "JE SOUHAITE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = NewKetTextSecond,
                            letterSpacing = 1.sp
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            RoleCard(
                                label = "Acheteur",
                                emoji = "🛍️",
                                selected = selectedRole == "customer",
                                onClick = { selectedRole = "customer" },
                                modifier = Modifier.weight(1f)
                            )
                            RoleCard(
                                label = "Vendeur",
                                emoji = "🏪",
                                selected = selectedRole == "supplier",
                                onClick = { selectedRole = "supplier" },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        NewKetTextField(
                            value = regName,
                            onValueChange = { regName = it },
                            label = "Nom complet"
                        )

                        NewKetTextField(
                            value = regEmail,
                            onValueChange = { regEmail = it },
                            label = "Adresse email",
                            keyboardType = KeyboardType.Email
                        )

                        // ── Mot de passe + jauge de force ─────────────────
                        NewKetPasswordField(
                            value = regPassword,
                            onValueChange = { regPassword = it },
                            label = "Mot de passe",
                            visible = regPasswordVisible,
                            onToggleVisibility = { regPasswordVisible = !regPasswordVisible }
                        )

                        // Jauge de force (identique au site)
                        if (regPassword.isNotEmpty()) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    for (i in 1..4) {
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(4.dp)
                                                .clip(RoundedCornerShape(2.dp))
                                                .background(
                                                    if (i <= passwordStrength.score) passwordStrength.color
                                                    else NewKetBorderLight
                                                )
                                        )
                                    }
                                }
                                Text(
                                    text = passwordStrength.label.uppercase(),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = passwordStrength.color,
                                    letterSpacing = 1.sp,
                                    modifier = Modifier.fillMaxWidth(),
                                    textAlign = TextAlign.End
                                )
                            }
                        }

                        // ── Confirmer le mot de passe ─────────────────────
                        NewKetPasswordField(
                            value = regConfirm,
                            onValueChange = { regConfirm = it },
                            label = "Confirmer le mot de passe",
                            visible = regConfirmVisible,
                            onToggleVisibility = { regConfirmVisible = !regConfirmVisible },
                            isError = regConfirm.isNotEmpty() && regConfirm != regPassword
                        )
                        if (regConfirm.isNotEmpty() && regConfirm != regPassword) {
                            Text(
                                text = "Les mots de passe ne correspondent pas",
                                color = NewKetError,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        if (state.error != null) {
                            Text(
                                text = state.error!!,
                                color = NewKetError,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        NewKetPrimaryButton(
                            label = "Créer mon compte",
                            isLoading = state.isLoading,
                            enabled = regConfirm == regPassword && regPassword.isNotEmpty(),
                            onClick = {
                                val apiRole = if (selectedRole == "supplier") "supplier" else "buyer"
                                viewModel.register(regName, regEmail, regPassword, apiRole)
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // ── Divider "OU VIA" ──────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = NewKetBorderLight)
                Text(
                    text = "  OU VIA  ",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = NewKetTextLight,
                    letterSpacing = 1.sp
                )
                HorizontalDivider(modifier = Modifier.weight(1f), color = NewKetBorderLight)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ── Boutons OAuth : Google + Passkey (identiques au site) ─────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Google
                OAuthButton(
                    label = "Google",
                    icon = {
                        Text("G", fontSize = 14.sp, fontWeight = FontWeight.Black,
                            color = Color(0xFF4285F4))
                    },
                    onClick = { },
                    modifier = Modifier.weight(1f)
                )
                // Passkey (même icône que le site)
                OAuthButton(
                    label = "Passkey",
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Fingerprint,
                            contentDescription = "Passkey",
                            tint = NewKetTextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    },
                    onClick = { },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── Continuer en invité ───────────────────────────────────────────
            Text(
                text = "Continuer en tant qu'invité",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = NewKetTextSecond,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onContinueAsGuest() }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ── CGU (identique au site) ───────────────────────────────────────
            Text(
                text = "En continuant, vous acceptez nos\nConditions d'utilisation et notre Politique de confidentialité.",
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = NewKetTextLight,
                textAlign = TextAlign.Center,
                lineHeight = 15.sp,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants réutilisables
// ─────────────────────────────────────────────────────────────────────────────

@Composable
fun TabButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.Start,
        modifier = Modifier
            .clickable { onClick() }
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = if (selected) NewKetBlack else NewKetTextLight,
            letterSpacing = 1.5.sp,
            modifier = Modifier.padding(bottom = 10.dp)
        )
        Box(
            modifier = Modifier
                .width(if (selected) 40.dp else 0.dp)
                .height(2.dp)
                .background(if (selected) NewKetBlack else Color.Transparent)
        )
    }
}

@Composable
fun NewKetTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = {
            Text(label.uppercase(), fontSize = 10.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = NewKetBlack,
            unfocusedBorderColor = Color.Transparent,
            focusedLabelColor = NewKetBlack,
            unfocusedLabelColor = NewKetTextSecond,
            focusedTextColor = NewKetTextPrimary,
            unfocusedTextColor = NewKetTextPrimary,
            focusedContainerColor = NewKetWhite,
            unfocusedContainerColor = NewKetInputBg
        ),
        singleLine = true
    )
}

@Composable
fun NewKetPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    visible: Boolean,
    onToggleVisibility: () -> Unit,
    isError: Boolean = false,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = {
            Text(label.uppercase(), fontSize = 10.sp,
                fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        },
        trailingIcon = {
            IconButton(onClick = onToggleVisibility) {
                Icon(
                    imageVector = if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    contentDescription = null,
                    tint = NewKetTextLight
                )
            }
        },
        isError = isError,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = if (isError) NewKetError else NewKetBlack,
            unfocusedBorderColor = if (isError) NewKetError else Color.Transparent,
            focusedLabelColor = NewKetBlack,
            unfocusedLabelColor = NewKetTextSecond,
            focusedTextColor = NewKetTextPrimary,
            unfocusedTextColor = NewKetTextPrimary,
            focusedContainerColor = NewKetWhite,
            unfocusedContainerColor = NewKetInputBg
        ),
        singleLine = true
    )
}

@Composable
fun NewKetPrimaryButton(
    label: String,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(56.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = NewKetBlack,
            contentColor = NewKetWhite,
            disabledContainerColor = Color(0xFF9CA3AF),
            disabledContentColor = Color.White
        ),
        enabled = !isLoading && enabled
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = NewKetWhite,
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp
            )
        } else {
            Text(label.uppercase(), fontSize = 11.sp,
                fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
        }
    }
}

@Composable
fun RoleCard(
    label: String,
    emoji: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) NewKetBlack else NewKetInputBg)
            .border(
                width = 2.dp,
                color = if (selected) NewKetBlack else NewKetBorder,
                shape = RoundedCornerShape(16.dp)
            )
            .clickable { onClick() }
            .padding(vertical = 12.dp, horizontal = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text = emoji, fontSize = 20.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label.uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = if (selected) NewKetWhite else NewKetTextSecond,
                letterSpacing = 1.sp
            )
        }
    }
}

@Composable
fun OAuthButton(
    label: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(16.dp),
        border = ButtonDefaults.outlinedButtonBorder.copy(width = 2.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = NewKetTextPrimary,
            containerColor = NewKetWhite
        )
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            icon()
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black,
                color = NewKetTextPrimary)
        }
    }
}
