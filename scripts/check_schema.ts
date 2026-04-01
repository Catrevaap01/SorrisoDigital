
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const checkSchema = async () => {
    const extra = Constants.expoConfig?.extra;
    const url = extra?.SUPABASE_URL;
    const key = extra?.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Keys missing');
        return;
    }

    const supabase = createClient(url, key);

    // Check last_session_id column in profiles
    const { data: cols, error: colError } = await supabase
        .rpc('get_table_columns', { table_name: 'profiles' }); // This might not exist

    if (colError) {
        // Fallback: try to select one row
        const { data, error } = await supabase.from('profiles').select('*').limit(1);
        if (error) {
            console.error('Error selecting from profiles:', error);
        } else if (data && data.length > 0) {
            console.log('Columns in profiles:', Object.keys(data[0]));
        } else {
            console.log('No data in profiles to check columns');
        }
    } else {
        console.log('Columns:', cols);
    }
};

checkSchema();
