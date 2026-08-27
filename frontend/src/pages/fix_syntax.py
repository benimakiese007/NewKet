import sys
import re

filepath = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("else showInlineMessage('order-modal-feedback', error?.message || 'Impossible de signaler l\\'absence.', 'error');", "if (window.showInlineFeedback && btn) window.showInlineFeedback(btn, error?.message || 'Impossible de signaler l\\'absence.', 'error');\n                        else showInlineMessage('order-modal-feedback', error?.message || 'Impossible de signaler l\\'absence.', 'error');")

content = content.replace("'Signaler l\\'absence du client ? S\\'il ne se présente pas dans 48h, la commande sera annulée et vous serez dédommagé.'", '"Signaler l\'absence du client ? S\'il ne se présente pas dans 48h, la commande sera annulée et vous serez dédommagé."')

content = content.replace("error?.message || 'Impossible de signaler l\\'absence.'", 'error?.message || "Impossible de signaler l\'absence."')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
