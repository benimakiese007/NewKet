import os
import requests

url = 'https://kuygjocnnlvjtoaquicq.supabase.co/rest/v1/users?role=eq.supplier&status=eq.approved&select=id,email,company_name,identity_document_urls'
headers = {
    'apikey': os.getenv('SUPABASE_KEY', ''),
    'Authorization': f"Bearer {os.getenv('SUPABASE_KEY', '')}",
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
    
    if not bad_sellers:
        print("No approved sellers with missing documents found.")
    else:
        print(f"Found {len(bad_sellers)} approved sellers to fix.")
        dummy_docs = [
            "https://res.cloudinary.com/dzhnphyp3/image/upload/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg",
            "https://res.cloudinary.com/dzhnphyp3/image/upload/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg"
        ]
        
        for seller in bad_sellers:
            update_url = f"https://kuygjocnnlvjtoaquicq.supabase.co/rest/v1/users?id=eq.{seller['id']}"
            update_payload = {
                "identity_document_urls": dummy_docs
            }
            patch_headers = headers.copy()
            patch_headers['Prefer'] = 'return=minimal'
            
            patch_res = requests.patch(update_url, headers=patch_headers, json=update_payload)
            if patch_res.status_code in [200, 204]:
                print(f"Fixed {seller['company_name']} ({seller['email']})")
            else:
                print(f"Failed to fix {seller['company_name']}: {patch_res.status_code} - {patch_res.text}")
else:
    print(f'Error fetching users: {response.status_code}', response.text)
