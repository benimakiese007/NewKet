path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\payout-security.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old_script_end = """        window.addEventListener('newketInitialized', () => {
            loadRequests();
        });

        if (window.newketInitialized) {
            loadRequests();
        }
    </script>"""

new_script_end = """        let realtimeChannel = null;

        function startRealtime() {
            if (!window.supabaseClient) return;
            if (realtimeChannel) {
                window.supabaseClient.removeChannel(realtimeChannel);
            }
            realtimeChannel = window.supabaseClient
                .channel('payout-security-realtime')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'support_tickets',
                    filter: 'type=eq.PAYOUT_CHANGE'
                }, (payload) => {
                    console.log('[PayoutSecurity] Realtime event:', payload.eventType);
                    // Flash notification badge
                    showRealtimeBadge(payload.eventType);
                    // Reload list
                    loadRequests();
                })
                .subscribe((status) => {
                    const dot = document.getElementById('realtimeDot');
                    if (dot) {
                        dot.className = status === 'SUBSCRIBED'
                            ? 'w-2 h-2 rounded-full bg-green-400 animate-pulse'
                            : 'w-2 h-2 rounded-full bg-gray-300';
                    }
                    const label = document.getElementById('realtimeLabel');
                    if (label) label.textContent = status === 'SUBSCRIBED' ? 'En direct' : 'Connexion...';
                });
        }

        function showRealtimeBadge(eventType) {
            const badge = document.getElementById('realtimeEventBadge');
            if (!badge) return;
            badge.textContent = eventType === 'INSERT' ? '🔔 Nouvelle demande !' : '🔄 Mise à jour';
            badge.classList.remove('hidden');
            clearTimeout(window._rtBadgeTimer);
            window._rtBadgeTimer = setTimeout(() => badge.classList.add('hidden'), 4000);
        }

        window.addEventListener('newketInitialized', () => {
            loadRequests();
            startRealtime();
        });

        if (window.newketInitialized) {
            loadRequests();
            startRealtime();
        }
    </script>"""

c = c.replace(old_script_end, new_script_end)

# Add realtime status indicator in the header actions
old_actions = """                        <button onclick="loadRequests()" class="w-full sm:w-auto bg-black text-white px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-900 transition-all">
                            <iconify-icon icon="solar:refresh-bold" width="14"></iconify-icon> Actualiser
                        </button>"""
new_actions = """                        <div class="flex items-center gap-2 px-4 py-3 bg-white border border-gray-100 rounded-2xl">
                            <div id="realtimeDot" class="w-2 h-2 rounded-full bg-gray-300"></div>
                            <span id="realtimeLabel" class="text-xs font-bold text-gray-500">Connexion...</span>
                            <span id="realtimeEventBadge" class="hidden ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full">🔔 Nouvelle demande !</span>
                        </div>
                        <button onclick="loadRequests()" class="w-full sm:w-auto bg-black text-white px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-900 transition-all">
                            <iconify-icon icon="solar:refresh-bold" width="14"></iconify-icon> Actualiser
                        </button>"""

c = c.replace(old_actions, new_actions)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Done:", "startRealtime" in c, "realtimeDot" in c)
