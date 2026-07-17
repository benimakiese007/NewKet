import { supabase } from '../config/supabase.js';

export const getCategories = async (req, res) => {
    try {
        
        // Fetch categories ranked from the SQL view we created
        const { data, error } = await supabase
            .from('categories_ranked')
            .select('*')
            .limit(10); // get top 10 categories

        if (error) throw error;

        // Ensure we always have Promos as a fallback for the frontend UI logic
        const categories = data.map(row => ({
            id: row.category,
            label: row.category,
            score: row.score
        }));

        res.json({ data: categories });
    } catch (err) {
        console.error('❌ getCategories error:', err);
        res.status(500).json({ error: err.message });
    }
};
