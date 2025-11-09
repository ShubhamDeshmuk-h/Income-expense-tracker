import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

/**
 * Check for updates and apply them if available
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    // Only check for updates in production builds, not in development
    if (__DEV__) {
      console.log('Updates are disabled in development mode');
      return false;
    }

    if (!Updates.isEnabled) {
      console.log('Updates are not enabled');
      return false;
    }

    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log('Update available, downloading...');
        await Updates.fetchUpdateAsync();
        console.log('Update downloaded, reloading app...');
        
        // Show alert to user
        Alert.alert(
          'Update Available',
          'A new version of the app is available. The app will restart to apply the update.',
          [
            {
              text: 'Restart Now',
              onPress: () => {
                Updates.reloadAsync();
              },
            },
          ],
          { cancelable: false }
        );
        
        return true;
      } else {
        console.log('No updates available');
        return false;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in checkForUpdates:', error);
    return false;
  }
}

/**
 * Check for updates silently and apply them in the background
 */
export async function checkForUpdatesSilently(): Promise<void> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Automatically reload after download
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.error('Error in silent update check:', error);
  }
}

/**
 * Get current update information
 */
export async function getUpdateInfo() {
  try {
    if (!Updates.isEnabled) {
      return null;
    }

    return {
      isEnabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId,
      channel: Updates.channel,
      createdAt: Updates.createdAt,
      runtimeVersion: Updates.runtimeVersion,
    };
  } catch (error) {
    console.error('Error getting update info:', error);
    return null;
  }
}

