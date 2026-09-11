# Personal Finance Tracker

A comprehensive personal income and expense tracking application built with React Native Expo and Supabase, featuring advanced analytics, security, and export capabilities.

## Features

### Core Features
- **Dashboard**: View total income, expenses, and separate balances for cash and bank accounts
- **Add Transactions**: Easily add income or expense transactions with:
  - Transaction type (Income/Expense)
  - Payment mode (Cash/Bank)
  - Category selection
  - Amount, date, and optional notes
  - **Bill Image Attachments**: Attach photos of bills and receipts
- **Transaction History**: View all transactions with:
  - Filtering by type, mode, and category
  - Edit transaction details
  - Delete transactions
  - View attached bill images
  - Real-time balance updates
- **Automatic Balance Updates**: Balances are automatically calculated using database triggers

### 📊 Monthly Summary Dashboard
- **Income vs Expense Bar Chart**: Visual comparison of monthly income and expenses
- **Expense Distribution Pie Chart**: See how expenses are distributed across categories
- **6-Month Trends Line Chart**: Track income and expense trends over time
- **Balance Summary**: Display total cash, bank, and combined balance
- **Advanced Filtering**: Filter by date, month, or category

### 🔒 Security Features
- **PIN Lock**: Secure your app with a 4-6 digit PIN
- **Biometric Authentication**: Use fingerprint or face ID (when available)
- **Secure Storage**: All sensitive data stored securely using expo-secure-store

### 🔔 Reminders & Alerts
- **Monthly Summary Alerts**: Get notified on the 1st of each month
- **Large Transaction Alerts**: Receive notifications for transactions above a threshold
- **Low Balance Alerts**: Get warned when your balance falls below a set threshold
- **Customizable Thresholds**: Configure alert thresholds in settings

### 📤 Export & Backup
- **CSV Export**: Export all transactions to CSV format
- **Excel Export**: Export transactions to Excel (.xlsx) format
- **Local Backup**: Create and restore backups from device storage
- **Share Functionality**: Share exported files or backups via native sharing

### 💬 Notes & Attachments
- **Transaction Notes**: Add detailed notes to each transaction
- **Bill Image Attachments**: Attach photos of bills and receipts
- **Image Viewer**: View attached images in full-screen mode
- **Camera Integration**: Take photos directly from the app

## Database Schema

### Transactions Table
- Stores all income and expense records
- Fields: type, mode, category, amount, date, note, attachment_url
- Indexed for fast querying
- Supports bill image attachments

### Balances Table
- Maintains current balance for cash and bank
- Automatically updated via database triggers
- Tracks total income, expense, and current balance

### User Settings Table
- Stores user preferences and security settings
- PIN hash, biometric settings
- Alert preferences and thresholds

## Technology Stack

- **Frontend**: React Native Expo
- **Database**: Supabase (PostgreSQL)
- **Navigation**: Expo Router (tabs-based)
- **Icons**: Lucide React Native
- **Charts**: react-native-chart-kit
- **Security**: expo-secure-store, expo-local-authentication
- **Notifications**: expo-notifications
- **File System**: expo-file-system
- **Image Picker**: expo-image-picker
- **Export**: xlsx (Excel), CSV

## Getting Started

### Prerequisites
- Node.js and npm installed
- Expo CLI installed globally: `npm install -g expo-cli`
- EAS CLI installed globally: `npm install -g eas-cli`
- Supabase account (or use the pre-configured database)
- EAS account (for OTA updates) - Sign up at https://expo.dev

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (optional):
   Create a `.env` file with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run database migrations:
   Apply the SQL migrations in the `supabase/migrations` folder to your Supabase database.

5. Link your project to EAS (for OTA updates):
   ```bash
   eas login
   eas build:configure
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

### Database Setup

Run the following migrations in order:
1. `20251105182804_create_finance_tracker_tables.sql` - Creates transactions and balances tables
2. `20251105183554_fix_security_issues.sql` - Security fixes
3. `20251106000000_add_attachments_and_settings.sql` - Adds attachment support and user settings

## Usage

### Setting Up Security
1. Go to Settings tab
2. Enable PIN Lock (set a 4-6 digit PIN)
3. Optionally enable Biometric Authentication if available on your device

### Configuring Alerts
1. Go to Settings tab
2. Enable/disable alerts as needed:
   - Monthly Summary Alerts
   - Large Transaction Alerts (set threshold)
   - Low Balance Alerts (set threshold)

### Adding Transactions with Attachments
1. Go to Add tab
2. Fill in transaction details
3. Tap "Choose from Gallery" or "Take Photo" to attach a bill image
4. Submit the transaction

### Viewing Analytics
1. Go to Summary tab
2. View charts and analytics for the selected month
3. Use the filter button to change month or category

### Exporting Data
1. Go to Settings tab
2. Tap "Export to CSV" or "Export to Excel"
3. Share or save the exported file

### Creating Backups
1. Go to Settings tab
2. Tap "Create Backup" to save all transactions
3. Use "Restore Backup" to restore from a previous backup

## Features in Detail

### Monthly Summary Dashboard
- **Income vs Expense Bar Chart**: Visual comparison showing income in green and expenses in red
- **Expense Distribution Pie Chart**: See which categories consume most of your budget
- **6-Month Trends**: Track your financial trends over the last 6 months
- **Filters**: Filter by month and category to see specific insights

### Security
- **PIN Protection**: All data is protected behind a PIN lock
- **Biometric Support**: Use fingerprint or face ID for quick access
- **Secure Storage**: PIN and settings stored securely using device keychain

### Notifications
- **Monthly Summaries**: Automated notifications on the 1st of each month
- **Large Transactions**: Instant alerts for transactions above your threshold
- **Low Balance**: Warnings when balance falls below threshold

### Export & Backup
- **Multiple Formats**: Export to CSV or Excel
- **Full Backup**: Backup all transactions with metadata
- **Easy Restore**: Restore from backup with one tap
- **Share Integration**: Share files using native sharing

## OTA Updates (Over-The-Air Updates)

This app supports automatic OTA updates using EAS Update. Users who install your APK will automatically receive updates when you publish them, without needing to download a new APK.

### Publishing Updates

1. **Build Production APK** (first time):
   ```bash
   eas build --platform android --profile production
   ```

2. **Distribute APK** to users (download from EAS dashboard)

3. **Make code changes** (JavaScript/TypeScript only - no native changes)

4. **Publish update**:
   ```bash
   npm run update:production
   ```

5. **Users receive update** automatically on next app launch

### Important Notes

- ✅ Can update: JavaScript code, assets, UI changes
- ❌ Cannot update: Native dependencies, Expo SDK version, native code changes
- For native changes, you must build a new APK

See [EAS_UPDATE_GUIDE.md](./EAS_UPDATE_GUIDE.md) for detailed documentation.

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.
