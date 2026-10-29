import requests
import mimetypes
import os
import json

SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co'
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')

email_target = 'benimakiese123@gmail.com'

files_to_upload = [
    r"C:\Users\tmaut\.gemini\antigravity\brain\779782b9-a053-4896-8340-6315663d66f3\.user_uploaded\media_1789214225737.jpg",
    r"C:\Users\tmaut\.gemini\antigravity\brain\779782b9-a053-4896-8340-6315663d66f3\.user_uploaded\media_1789214225917.jpg"
]

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}'
}

# 1. Get user id
print(f"Fetching user ID for {email_target}...")
users_url = f"{SUPABASE_URL}/rest/v1/users?email=eq.{email_target}&select=id"
res = requests.get(users_url, headers=headers)
if res.status_code == 200 and len(res.json()) > 0:
    user_id = res.json()[0]['id']
    print(f"Found user ID: {user_id}")
else:
    print(f"Error fetching user: {res.text}")
    exit(1)

# 2. Upload files
uploaded_urls = []
for i, file_path in enumerate(files_to_upload):
    print(f"Uploading file {i+1}...")
    filename = os.path.basename(file_path)
    storage_path = f"kyc/{user_id}/uploaded_by_agent_{filename}"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/vendor-docs/{storage_path}"
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    upload_headers = headers.copy()
    upload_headers['Content-Type'] = 'image/jpeg'
    
    upload_res = requests.post(upload_url, headers=upload_headers, data=file_data)
    if upload_res.status_code in [200, 201]:
        print(f"Uploaded successfully to {storage_path}")
        public_url_res = f"{SUPABASE_URL}/storage/v1/object/public/vendor-docs/{storage_path}"
        uploaded_urls.append(public_url_res)
    else:
        print(f"Upload failed: {upload_res.status_code} - {upload_res.text}")
        exit(1)

# 3. Update user profile
print("Updating user profile with new documents...")
update_url = f"{SUPABASE_URL}/rest/v1/users?id=eq.{user_id}"
patch_headers = headers.copy()
patch_headers['Content-Type'] = 'application/json'
patch_headers['Prefer'] = 'return=minimal'

patch_res = requests.patch(update_url, headers=patch_headers, json={
    "identity_document_urls": uploaded_urls
})

if patch_res.status_code in [200, 204]:
    print(f"Successfully updated identity_document_urls for {email_target}!")
else:
    print(f"Failed to update user: {patch_res.status_code} - {patch_res.text}")
