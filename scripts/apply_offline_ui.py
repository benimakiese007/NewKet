import os

def append_offline_listener():
    path = r"C:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\main.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    offline_code = """
// --- OFFLINE/ONLINE LISTENER ---
window.addEventListener('offline', () => {
    if (window.UI) {
        window.UI.showToast("Vous êtes hors ligne. Mode lecture seule activé.", 'warning');
        document.body.classList.add('is-offline');
    }
});

window.addEventListener('online', () => {
    if (window.UI) {
        window.UI.showToast("Connexion rétablie ! Les données sont à jour.", 'success');
        document.body.classList.remove('is-offline');
        // Refresh cache optionally
    }
});
// -------------------------------
"""
    if "window.addEventListener('offline'" not in content:
        with open(path, 'a', encoding='utf-8') as f:
            f.write(offline_code)
        print("main.js updated with offline listeners.")
    else:
        print("Offline listeners already present.")

append_offline_listener()
