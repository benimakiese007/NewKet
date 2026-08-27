import sys
import re

filepath = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the catch block by regex to be safe
pattern = r"\} catch \(error\) \{(.*?)\} finally \{"
replacement = r"""} catch (error) {
                        if (window.showInlineFeedback && btn) window.showInlineFeedback(btn, error?.message || "Impossible de signaler l'absence.", 'error');
                        else showInlineMessage('order-modal-feedback', error?.message || "Impossible de signaler l'absence.", 'error');
                    } finally {"""
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
