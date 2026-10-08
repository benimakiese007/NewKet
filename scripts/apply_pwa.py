import os

def patch_vite_config():
    path = r"C:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\vite.config.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add VitePWA import
    if "import { VitePWA } from 'vite-plugin-pwa';" not in content:
        content = "import { VitePWA } from 'vite-plugin-pwa';\n" + content

    # Add VitePWA to plugins
    plugin_snippet = """    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5000000
      },
      manifest: false // We already have a manifest.json manually generated
    }),
"""
    if "VitePWA({" not in content:
        content = content.replace("plugins: [", "plugins: [\n" + plugin_snippet)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("vite.config.js patched for PWA.")

patch_vite_config()
