import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SECRET_KEY;

if (!url || !key) {
	throw new Error(
		'None SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY – fill .env.local (e.g. .env.example).',
	);
}

export const supabase = createClient(url, key, {
	auth: { persistSession: false },
});
