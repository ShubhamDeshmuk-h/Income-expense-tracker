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
      ...config.extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kihgmhodhbwaocugeygz.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaGdtaG9kaGJ3YW9jdWdleWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjcwNDMsImV4cCI6MjA3Nzk0MzA0M30.kkb2DR1KfLtIrnNdgxyDMN9xJBnOdSJqENxPZsazB2w',
      eas: {
        projectId: 'e75a47f0-98e0-4a46-becc-0caf782343dc'
      }
    }
  };
};