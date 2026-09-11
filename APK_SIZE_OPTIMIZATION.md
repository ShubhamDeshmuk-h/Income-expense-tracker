# APK Size Optimization Guide

This guide explains how to generate a smaller APK file while maintaining all functionality.

## Current Optimizations Applied

### 1. Babel Configuration
- ✅ Configured `babel-plugin-module-resolver` for path aliases
- ✅ Enables tree-shaking and code optimization

### 2. TypeScript Configuration
- ✅ Added `baseUrl` for proper path resolution
- ✅ Configured path aliases correctly

### 3. EAS Build Configuration
- ✅ Production build with optimization enabled
- ✅ Uses latest build image for better optimizations

## Build Commands

### Standard Production APK
```bash
eas build --platform android --profile production
```

### Optimized Production APK (Recommended)
```bash
eas build --platform android --profile production --clear-cache
```

## Additional Optimization Tips

### 1. Enable ProGuard/R8 (Automatic)
- ProGuard/R8 is automatically enabled in release builds
- Removes unused code and obfuscates the code
- Can reduce APK size by 30-50%

### 2. Optimize Assets
- Use WebP format for images instead of PNG/JPG
- Compress images before adding to assets
- Remove unused assets from the project

### 3. Remove Unused Dependencies
- Regularly audit `package.json` for unused packages
- Use tools like `depcheck` to find unused dependencies
- Remove large unused libraries

### 4. Enable Hermes Engine (Default)
- Hermes is enabled by default in Expo SDK 54+
- Reduces APK size and improves performance
- Faster app startup time

### 5. Split APKs by Architecture (Not Recommended for Direct Distribution)
- For Play Store: Use App Bundle (AAB) format
- For direct APK distribution: Use universal APK (current setup)

### 6. Code Splitting
- Use dynamic imports for large libraries
- Lazy load screens/components when possible
- Split vendor code from application code

## Expected APK Sizes

With optimizations:
- **Initial Size**: ~25-35 MB (with all features)
- **After ProGuard**: ~15-25 MB
- **With asset optimization**: ~12-20 MB

## Monitoring APK Size

After building, check the APK size:
1. Download APK from EAS dashboard
2. Check file size in file explorer
3. Use `aapt dump badging app.apk` to see detailed size breakdown

## Troubleshooting

### APK Still Too Large

1. **Check Asset Sizes**
   ```bash
   # Find large files
   find assets -type f -exec ls -lh {} \; | awk '{ print $5 ": " $9 }' | sort -hr
   ```

2. **Analyze Dependencies**
   ```bash
   npm install -g depcheck
   depcheck
   ```

3. **Check Bundle Size**
   - Build and analyze the JavaScript bundle
   - Look for large dependencies that can be optimized

### Build Fails After Optimization

1. **Clear Cache**
   ```bash
   eas build --platform android --profile production --clear-cache
   ```

2. **Check for Missing Dependencies**
   - Ensure all required packages are in `package.json`
   - Verify babel.config.js is correct

3. **Verify Path Aliases**
   - Ensure babel.config.js has module-resolver configured
   - Check tsconfig.json paths are correct

## Best Practices

1. **Regular Audits**: Periodically review and remove unused code/assets
2. **Image Optimization**: Always compress images before adding
3. **Dependency Management**: Keep dependencies updated and remove unused ones
4. **Code Splitting**: Use dynamic imports for large features
5. **Monitoring**: Track APK size over time to catch size increases

## Size Comparison

| Component | Estimated Size |
|-----------|---------------|
| React Native Core | ~5-7 MB |
| Expo SDK | ~3-5 MB |
| App Code (JS) | ~2-4 MB |
| Assets (Images) | ~1-3 MB |
| Native Libraries | ~3-5 MB |
| **Total (Optimized)** | **~15-25 MB** |

## Next Steps

1. Build your APK:
   ```bash
   eas build --platform android --profile production --clear-cache
   ```

2. Check the APK size after build

3. If still large, review assets and dependencies

4. Consider using App Bundle (AAB) for Play Store distribution (smaller downloads)

## App Bundle (AAB) for Play Store

For Play Store distribution, use AAB format which is more optimized:

```bash
eas build --platform android --profile production-aab
```

AAB allows Google Play to generate optimized APKs for each device architecture, resulting in smaller downloads for users.

