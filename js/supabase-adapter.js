/**
 * Supabase Adapter for NOVA V2
 * Bridges the gap between the existing managers and the Supabase database.
 */
const SupabaseAdapter = {
    async fetch(table, select = '*') {
        const { data, error } = await window.supabaseClient
            .from(table)
            .select(select);

        if (error) {
            console.error(`Error fetching from ${table}:`, error);
            return [];
        }
        return data;
    },

    async insert(table, item) {
        const { data, error } = await window.supabaseClient
            .from(table)
            .insert(item)
            .select();

        if (error) {
            console.error(`Error inserting into ${table}:`, error);
            return null;
        }
        return data[0];
    },

    async update(table, id, updates, idColumn = 'id') {
        const { data, error } = await window.supabaseClient
            .from(table)
            .update(updates)
            .eq(idColumn, id)
            .select();

        if (error) {
            console.error(`Error updating items in ${table}:`, error);
            return null;
        }
        return data[0];
    },

    async delete(table, id, idColumn = 'id') {
        const { error } = await window.supabaseClient
            .from(table)
            .delete()
            .eq(idColumn, id);

        if (error) {
            console.error(`Error deleting from ${table}:`, error);
            return false;
        }
        return true;
    },

    async upsert(table, item, onConflict = 'id') {
        const { data, error } = await window.supabaseClient
            .from(table)
            .upsert(item, { onConflict })
            .select();

        if (error) {
            console.error(`Error upserting into ${table}:`, error);
            return null;
        }
        return data[0];
    }
};

window.SupabaseAdapter = SupabaseAdapter;
