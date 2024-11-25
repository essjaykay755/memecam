import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function CameraScreen() {
  const [type, setType] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    requestPermission();
    requestMediaPermission();
  }, []);

  if (!permission?.granted || !mediaPermission?.granted) {
    return (
      <ThemedView style={styles.container}>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            requestPermission();
            await requestMediaPermission();
          }}>
          <ThemedText type="defaultSemiBold">Grant Camera Permission</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const toggleCameraType = () => {
    setType((current) => current === 'back' ? 'front' : 'back');
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      // Handle the selected image
      console.log('Selected image:', result.assets[0].uri);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <CameraView 
        ref={cameraRef} 
        style={styles.camera} 
        facing={type}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleCameraType}>
            <IconSymbol name="arrow.triangle.2.circlepath" size={28} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.shutterButton} onPress={takePicture}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={openGallery}>
            <IconSymbol name="photo.on.rectangle" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: 'white',
  },
  permissionButton: {
    padding: 20,
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 50,
  },
}); 