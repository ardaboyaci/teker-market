import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function provisionAdmin() {
  const email = 'admin@tekermarket.com';
  const password = 'password123';

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) return console.error(listError);

  const user = users.find(u => u.email === email);
  if (user) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updateError) return console.error(updateError);
    console.log(`Updated existing user: ${email} / ${password}`);
  } else {
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createError) return console.error(createError);
    console.log(`Created new user: ${email} / ${password}`);
  }
}
provisionAdmin();
