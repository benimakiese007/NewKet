import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzY2NiwiZXhwIjoyMDg2OTE5NjY2fQ.QvH96s9FrZhzrvWjBjVNrBx00-tWTbhiPv9qnb2Bccg'
);

async function checkProduct() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, image')
    .in('id', ['prod-1775457725731', 'prod-1775961421445', 'prod-1775623307774', 'prod-1775522353588']);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkProduct();
