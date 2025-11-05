# Personal Finance Tracker

A lightweight, offline-focused personal income and expense tracking application built with React Native Expo and Supabase.

## Features

- **Dashboard**: View total income, expenses, and separate balances for cash and bank accounts
- **Add Transactions**: Easily add income or expense transactions with:
  - Transaction type (Income/Expense)
  - Payment mode (Cash/Bank)
  - Category selection
  - Amount, date, and optional notes
- **Transaction History**: View all transactions with:
  - Filtering by type, mode, and category
  - Edit transaction details
  - Delete transactions
  - Real-time balance updates
- **Automatic Balance Updates**: Balances are automatically calculated using database triggers

## Database Schema

### Transactions Table
- Stores all income and expense records
- Fields: type, mode, category, amount, date, note
- Indexed for fast querying

### Balances Table
- Maintains current balance for cash and bank
- Automatically updated via database triggers
- Tracks total income, expense, and current balance

## Technology Stack

- **Frontend**: React Native Expo
- **Database**: Supabase (PostgreSQL)
- **Navigation**: Expo Router (tabs-based)
- **Icons**: Lucide React Native

## Getting Started

The app is ready to use with the pre-configured Supabase database. Simply start the development server and begin tracking your finances!
