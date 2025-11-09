# EAS Update Setup Checklist

Follow these steps to set up automatic OTA updates for your Finance Tracker app.

## Initial Setup

- [ ] **Install EAS CLI**
  ```bash
  npm install -g eas-cli
  ```

- [ ] **Login to EAS**
  ```bash
  eas login
  ```

- [ ] **Configure EAS Project**
  ```bash
  eas build:configure
  ```
  This will create/update `eas.json` and link your project to EAS.

- [ ] **Verify Project ID**
  - Check that your project ID in `app.config.js` matches your EAS project
  - You can find your project ID in the EAS dashboard or by running `eas project:info`

- [ ] **Update app.config.js** (if needed)
  - Ensure the `updates.url` uses the correct project ID
  - The project ID should match the one in `eas.json`

## Building Your First APK

- [ ] **Build Production APK**
  ```bash
  eas build --platform android --profile production
  ```

- [ ] **Wait for Build to Complete**
  - Check build status in EAS dashboard
  - Download the APK when ready

- [ ] **Distribute APK**
  - Share the APK with your users
  - Users install the APK on their devices

## Publishing Updates

- [ ] **Make Code Changes**
  - Update JavaScript/TypeScript code
  - Update assets (images, fonts, etc.)
  - **Note**: Cannot update native code or dependencies

- [ ] **Test Changes Locally**
  ```bash
  npm run dev
  ```

- [ ] **Publish Update**
  ```bash
  npm run update:production
  ```
  Or manually:
  ```bash
  eas update --branch production --message "Description of changes"
  ```

- [ ] **Verify Update**
  - Check update status: `eas update:list --branch production`
  - Test on a device with the app installed

## Testing Updates

- [ ] **Install Production Build**
  - Build and install the production APK on a test device
  - Verify the app works correctly

- [ ] **Publish Test Update**
  ```bash
  eas update --branch production --message "Test update"
  ```

- [ ] **Open App on Test Device**
  - App should check for updates automatically
  - Update should download and apply
  - Verify changes are reflected

## Monitoring

- [ ] **Check Update Status**
  ```bash
  eas update:list --branch production
  ```

- [ ] **View Update Analytics**
  - Check EAS dashboard for update statistics
  - Monitor update adoption rate

## Troubleshooting

If updates are not working:

- [ ] **Verify Channel Match**
  - Ensure update is published to the same channel as the build
  - Check `eas.json` for channel configuration

- [ ] **Check Runtime Version**
  - Updates only work for the same runtime version
  - Verify SDK version hasn't changed

- [ ] **Verify Project ID**
  - Ensure project ID in `app.config.js` is correct
  - Check EAS dashboard for correct project ID

- [ ] **Check Network Connection**
  - Users need internet to receive updates
  - Verify app can reach update server

- [ ] **Review App Logs**
  - Check for error messages
  - Verify update check is running

## Important Reminders

- ✅ **Can Update OTA**: JavaScript code, assets, UI changes
- ❌ **Requires New Build**: Native dependencies, Expo SDK version, native code
- 🔄 **Test First**: Always test updates in preview before production
- 📱 **User Experience**: Updates download automatically, user is notified to restart

## Next Steps

After completing the checklist:

1. Build your first production APK
2. Distribute to users
3. Make code changes
4. Publish updates as needed
5. Monitor update adoption

For detailed documentation, see [EAS_UPDATE_GUIDE.md](./EAS_UPDATE_GUIDE.md)

