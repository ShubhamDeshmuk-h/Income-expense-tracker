const dotenv = require('dotenv');
const fs = require('fs');

// Load .env if present
const envFile = '.env';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  };
};
