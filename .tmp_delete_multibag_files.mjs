import { createClient } from '@supabase/supabase-js';

const orgId = '3540b73e-75f8-440a-a965-d80a53652c5d';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const extractPath = (publicUrl, bucket) => {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  return idx === -1 ? null : publicUrl.slice(idx + marker.length);
};

const removeBucketPaths = async (table, bucket) => {
  const { data, error } = await supabase
    .from(table)
    .select('file_url')
    .eq('organization_id', orgId);

  if (error) throw error;

  const paths = (data ?? []).map((row) => extractPath(row.file_url, bucket)).filter(Boolean);
  if (!paths.length) return { table, bucket, removed: 0 };

  const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
  if (removeError) throw removeError;

  return { table, bucket, removed: paths.length };
};

const results = [];
results.push(await removeBucketPaths('epi_signed_terms', 'signed-terms'));
results.push(await removeBucketPaths('employee_documents', 'employee-documents'));
console.log(JSON.stringify(results));
