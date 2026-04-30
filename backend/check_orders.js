import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzY2NiwiZXhwIjoyMDg2OTE5NjY2fQ.QvH96s9FrZhzrvWjBjVNrBx00-tWTbhiPv9qnb2Bccg'
);

async function checkOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, items')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkOrders();
