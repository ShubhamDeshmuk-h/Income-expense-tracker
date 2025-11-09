# EAS Update Guide - Automatic OTA Updates

This guide explains how to set up and use EAS Update for automatic Over-The-Air (OTA) updates in your Finance Tracker app.

## Overview

EAS Update allows you to push updates to your app without requiring users to download a new APK from the app store. When you publish an update, users who have the app installed will automatically receive the update the next time they open the app.

## Prerequisites

1. **EAS Account**: Make sure you're logged in to EAS CLI
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **EAS Project**: Ensure your project is linked to EAS
   ```bash
   eas build:configure
   ```
   When prompted, select the platforms you want to configure (Android in this case).
   
   **Note**: If `eas.json` already exists, you can skip this step. The configuration is already set up.

## How It Works

1. **Build with Update Channel**: When you build your APK, it's assigned to an update channel (production, preview, or development)
2. **Publish Updates**: After making code changes, publish an update to the same channel
3. **Automatic Updates**: Users with the app installed will check for updates on app launch and automatically download and apply them

## Workflow

### 1. Build Production APK

First, build your production APK with the production channel:

```bash
eas build --platform android --profile production
```

This creates an APK that is configured to receive updates from the "production" channel.

### 2. Distribute APK

Distribute the APK to your users (via direct download, email, etc.). Users install this APK on their devices.

### 3. Make Code Changes

After users have installed the APK, you can make changes to your code (UI improvements, bug fixes, new features, etc.).

**Important Notes:**
- You can only update JavaScript/TypeScript code and assets
- You **cannot** update native code changes (new dependencies, native modules, etc.)
- If you change native dependencies, you need to build a new APK

### 4. Publish Update

Publish the update to the production channel:

```bash
npm run update:production
```

Or manually:

```bash
eas update --branch production --message "Your update message here"
```

### 5. Users Receive Updates

When users open the app:
- The app automatically checks for updates (configured to check on app load)
- If an update is available, it downloads in the background
- User is notified and can restart the app to apply the update
- The app restarts with the new code

## Update Channels

The app uses three update channels:

- **production**: For production releases
- **preview**: For testing before production
- **development**: For development builds

Each build profile in `eas.json` is assigned to a specific channel.

## Commands

### Check for Updates (Manual)

Users can also manually check for updates in the Settings screen.

### Publish Updates

```bash
# Production updates
npm run update:production

# Preview updates
npm run update:preview

# List all updates
npm run update:check
```

### View Update History

```bash
eas update:list --branch production
```

## Configuration

### Update Check Behavior

The app is configured to check for updates automatically:
- **On App Load**: Checks for updates when the app starts
- **Manual Check**: Users can check for updates in Settings
- **Automatic Download**: Updates are downloaded automatically when available
- **User Notification**: Users are notified when an update is ready

### Runtime Version

The app uses SDK version as the runtime version. This means:
- Updates are only delivered to apps built with the same Expo SDK version
- If you upgrade the Expo SDK, you need to build a new APK

## Limitations

### What Can Be Updated via OTA:
- ✅ JavaScript/TypeScript code changes
- ✅ Asset files (images, fonts, etc.)
- ✅ UI/UX improvements
- ✅ Bug fixes in JavaScript code
- ✅ Configuration changes

### What Requires a New Build:
- ❌ Adding new native dependencies
- ❌ Changing native code
- ❌ Updating Expo SDK version
- ❌ Changing app permissions
- ❌ Changing app.config.js plugins that affect native code

## Best Practices

1. **Test Updates First**: Always test updates in preview channel before publishing to production
2. **Version Your Updates**: Use descriptive messages when publishing updates
3. **Monitor Updates**: Check update status and user adoption
4. **Gradual Rollout**: Consider using EAS Update's rollout percentage feature
5. **Fallback Strategy**: Always have a fallback if an update fails

## Troubleshooting

### Updates Not Appearing

1. **Check Channel Match**: Ensure the update is published to the same channel as the build
2. **Check Runtime Version**: Updates only work for the same runtime version
3. **Check Network**: Users need internet connection to receive updates
4. **Check Update Status**: Use `eas update:list` to verify the update was published

### Update Fails to Apply

1. **Check Logs**: Look for error messages in the app logs
2. **Clear Cache**: Users can clear app cache and try again
3. **Rebuild**: If updates consistently fail, you may need to rebuild the APK

### Development vs Production

- Updates are **disabled** in development mode (`npm run dev`)
- Updates only work in **production builds** from EAS
- Always test updates in a production build before distributing

## Example Workflow

```bash
# 1. Build initial APK
eas build --platform android --profile production

# 2. Distribute APK to users
# (Download from EAS dashboard and share with users)

# 3. Make code changes
# (Edit your code, fix bugs, add features)

# 4. Publish update
npm run update:production

# 5. Users automatically receive update on next app launch
```

## Additional Resources

- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Update Best Practices](https://docs.expo.dev/eas-update/workflow/)
- [Runtime Versions](https://docs.expo.dev/eas-update/runtime-versions/)

## Support

If you encounter issues with updates:
1. Check the EAS dashboard for update status
2. Review app logs for error messages
3. Verify channel and runtime version match
4. Consult EAS Update documentation

