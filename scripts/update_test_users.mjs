const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const emails = ['benimakiese1234567@gmail.com', 'benimakiese123@gmail.com'];
const newPassword = 'Phoenix_2026!';

async function updateTestUsers() {
    console.log('Fetching users...');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        console.error('Error listing users:', await response.text());
        return;
    }

    const data = await response.json();
    const users = data.users;

    for (const email of emails) {
        const user = users.find(u => u.email === email);
        if (user) {
            console.log(`Updating password for ${email} (ID: ${user.id})...`);
            const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: newPassword,
                    email_confirm: true
                })
            });
            if (!updateResponse.ok) {
                console.error(`Failed to update ${email}:`, await updateResponse.text());
            } else {
                console.log(`Successfully updated ${email}!`);
            }
        } else {
            console.log(`User ${email} not found. Creating...`);
            const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: newPassword,
                    email_confirm: true
                })
            });
            if (!createResponse.ok) {
                console.error(`Failed to create ${email}:`, await createResponse.text());
            } else {
                console.log(`Successfully created ${email}!`);
            }
        }
    }
}

updateTestUsers().catch(console.error);
