import requests

url = 'https://kuygjocnnlvjtoaquicq.supabase.co/rest/v1/users?role=eq.supplier&select=id,email,company_name,status,identity_document_urls'
headers = {
    'apikey': 'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM',
    'Authorization': 'Bearer sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM',
    'Content-Type': 'application/json'
}

response = requests.get(url, headers=headers)
if response.status_code == 200:
    users = response.json()
    bad_sellers = []
    for u in users:
        docs = u.get('identity_document_urls')
        if not docs or len(docs) < 2:
            bad_sellers.append(u)
    print(f'Found {len(bad_sellers)} sellers out of {len(users)} without both front and back IDs:')
    for u in bad_sellers:
        print(f"- {u.get('company_name')} ({u.get('email')}), Status: {u.get('status')}, Docs: {len(u.get('identity_document_urls') or [])}")
else:
    print(f'Error: {response.status_code}', response.text)
