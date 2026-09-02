import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const subjects = [
  'Commandes & Paiement',
  'Problème de connexion',
  'Livraison en retard',
  'Article défectueux',
  'Remboursement',
  'Question sur un produit'
];

async function seed() {
  console.log('Seeding 10 support tickets...');
  const tickets = [];
  for (let i = 0; i < 10; i++) {
    tickets.push({
      id: `TKT-${Date.now().toString().slice(-6)}-${i}`,
      subject: subjects[i % subjects.length],
      customer_name: `User ${i + 1}`,
      customer_email: `user${i + 1}@example.com`,
      message: `Ceci est un message de test numéro ${i + 1} pour vérifier le fonctionnement du support.`,
      status: i % 3 === 0 ? 'resolu' : 'ouvert'
    });
  }

  const { data, error } = await supabase.from('support_tickets').insert(tickets);

  if (error) {
    console.error('Erreur:', error);
  } else {
    console.log('10 tickets créés avec succès !');
  }
}

seed();
