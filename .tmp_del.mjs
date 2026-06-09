import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const paths = [
  '3540b73e-75f8-440a-a965-d80a53652c5d/b9f17b39-579d-4aeb-9b12-e329500c781b/2026-05-04-14-57-00-00-00-805e672f-f28e-4437-867b-bd1a8d52c037.pdf',
  '3540b73e-75f8-440a-a965-d80a53652c5d/c9c1aba3-eeec-4406-90c2-5c384b96b14c/2026-05-04-15-03-00-00-00-b73c1474-08ce-43cd-b16a-5d4aa4db971e.pdf',
];
const { data, error } = await s.storage.from('signed-terms').remove(paths);
console.log(JSON.stringify({ data, error }));
