path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old_insert = """                        // 2. Create ticket
                        const ticketData = {
                            subject: "Changement de numéro M-Pesa/Payout",
                            customer_name: accountName,
                            customer_email: user.email,
                            message: "Demande de sécurité soumise. Vérifiez le selfie et les documents.",
                            status: 'ouvert',
                            type: 'PAYOUT_CHANGE',
                            user_id: user.id,
                            metadata: {"""

new_insert = """                        // 2. Create ticket
                        const ticketData = {
                            id: crypto.randomUUID(),
                            subject: "Changement de numéro M-Pesa/Payout",
                            customer_name: accountName,
                            customer_email: user.email,
                            message: "Demande de sécurité soumise. Vérifiez le selfie et les documents.",
                            status: 'ouvert',
                            type: 'PAYOUT_CHANGE',
                            user_id: user.id,
                            metadata: {"""

if old_insert in c:
    c = c.replace(old_insert, new_insert)
    print("UUID fix applied")
else:
    print("UUID fix NOT applied. Searching for exact match...")
    idx = c.find("customer_name: accountName,")
    if idx != -1:
        print(c[max(0,idx-100):idx+100])

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
