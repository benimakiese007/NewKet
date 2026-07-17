package com.newket.app.ui.screens.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.newket.app.ui.theme.*

data class NotificationItem(
    val id: Int,
    val title: String,
    val message: String,
    val time: String,
    val isRead: Boolean,
    val emoji: String
)

@Composable
fun NotificationsScreen() {
    // Données de démo — à connecter à l'API
    val notifications = remember {
        listOf(
            NotificationItem(1, "Commande confirmée", "Votre commande #1042 a été confirmée par le vendeur.", "Il y a 5 min", false, "✅"),
            NotificationItem(2, "Nouveau message", "Un vendeur vous a répondu sur votre devis.", "Il y a 1h", false, "💬"),
            NotificationItem(3, "Livraison en cours", "Votre colis est en route. Livraison prévue demain.", "Il y a 3h", true, "🚚"),
            NotificationItem(4, "Promo exclusive", "−20% sur toute la collection Femme ce weekend.", "Hier", true, "🎁"),
            NotificationItem(5, "Avis demandé", "Comment s'est passée votre dernière commande ?", "Il y a 2 jours", true, "⭐"),
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFCFCFD))
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Notifications",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = NewKetTextPrimary,
                letterSpacing = (-0.5).sp
            )
            val unreadCount = notifications.count { !it.isRead }
            if (unreadCount > 0) {
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(NewKetBlack)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "$unreadCount non lu${if (unreadCount > 1) "s" else ""}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                }
            }
        }

        HorizontalDivider(color = NewKetBorderLight)

        if (notifications.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🔔", fontSize = 40.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Aucune notification",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = NewKetTextSecond
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(notifications) { notif ->
                    NotificationCard(notif)
                }
            }
        }
    }
}

@Composable
fun NotificationCard(notif: NotificationItem) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (!notif.isRead) Color.White else Color(0xFFF8FAFC)
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (!notif.isRead) 2.dp else 0.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Emoji icon
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(NewKetInputBg),
                contentAlignment = Alignment.Center
            ) {
                Text(text = notif.emoji, fontSize = 20.sp)
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notif.title,
                        fontSize = 13.sp,
                        fontWeight = if (!notif.isRead) FontWeight.Black else FontWeight.SemiBold,
                        color = NewKetTextPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    if (!notif.isRead) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(NewKetBlack)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = notif.message,
                    fontSize = 12.sp,
                    color = NewKetTextSecond,
                    lineHeight = 16.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = notif.time,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = NewKetTextLight
                )
            }
        }
    }
}
