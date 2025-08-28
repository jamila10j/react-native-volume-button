module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: '../android/src/main/java/com/volumebutton',
        packageImportPath: 'import com.volumebutton.VolumeButtonPackage;',
      },
      ios: {
        podspecPath: '../react-native-volume-button.podspec',
      },
    },
  },
};