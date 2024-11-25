import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Text, Platform } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { analyzeMemeImage } from '@/services/gemini';
import ViewShot, { captureRef } from 'react-native-view-shot';

interface MemeText {
  topText: string;
  bottomText: string;
}

type CameraMode = 'camera' | 'preview' | 'editing';

const MemeText = ({ text, style }: { text: string; style: any }) => (
  <Text
    style={[styles.memeText, style]}
    adjustsFontSizeToFit
    numberOfLines={2}
  >
    {text.toUpperCase()}
  </Text>
);

export default function CameraScreen() {
  const [type, setType] = useState<CameraType>('back');
  const [mode, setMode] = useState<CameraMode>('camera');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [memeText, setMemeText] = useState<MemeText | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const viewShotRef = useRef<View>(null);

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

  const generateMemeText = async (imageUri: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const memeText = await analyzeMemeImage(imageUri);
      setMemeText(memeText);
      setMode('editing');
    } catch (error) {
      console.error('Error generating meme:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to generate meme');
      }
      // Stay in preview mode but show error
      setMode('preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
        if (photo?.uri) {
          setCapturedImage(photo.uri);
          setMode('preview');
          await generateMemeText(photo.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const saveMeme = async () => {
    if (capturedImage && memeText && viewShotRef.current && !isSaving) {
      try {
        setIsSaving(true);
        
        // Wait a bit for the view to be fully rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Capture the view with text overlay
        const uri = await captureRef(viewShotRef, {
          format: "jpg",
          quality: 1,
          result: "tmpfile"
        });
        
        await MediaLibrary.saveToLibraryAsync(uri);
        setMode('camera');
        setCapturedImage(null);
        setMemeText(null);
      } catch (error) {
        console.error('Error saving meme:', error);
        setError('Failed to save meme. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const retryMeme = () => {
    setMode('camera');
    setCapturedImage(null);
    setMemeText(null);
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      setMode('preview');
      await generateMemeText(result.assets[0].uri);
    }
  };

  if (mode === 'preview' || mode === 'editing') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.memeContainer}>
          <View style={styles.memeTextContainer}>
            {isGenerating ? (
              <ThemedText style={styles.loadingText}>Generating meme...</ThemedText>
            ) : error ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => generateMemeText(capturedImage!)}
                >
                  <ThemedText style={styles.buttonText}>Retry</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <View 
                ref={viewShotRef}
                collapsable={false}
                style={styles.memeWrapper}
              >
                <MemeText 
                  text={memeText?.topText || ''} 
                  style={styles.topText} 
                />
                <Image 
                  source={{ uri: capturedImage! }} 
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <MemeText 
                  text={memeText?.bottomText || ''} 
                  style={styles.bottomText} 
                />
              </View>
            )}
          </View>
          
          <View style={styles.editButtons}>
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={retryMeme}
              disabled={isSaving}
            >
              <IconSymbol name="arrow.triangle.2.circlepath" size={28} color="white" />
              <ThemedText style={styles.buttonText}>New Photo</ThemedText>
            </TouchableOpacity>
            
            {memeText && !error && (
              <TouchableOpacity 
                style={[styles.editButton, isSaving && styles.disabledButton]} 
                onPress={saveMeme}
                disabled={isSaving}
              >
                <IconSymbol 
                  name={isSaving ? "hourglass" : "photo.on.rectangle"} 
                  size={28} 
                  color="white" 
                />
                <ThemedText style={styles.buttonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ThemedView>
    );
  }

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
  memeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  memeTextContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memeWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  memeText: {
    position: 'absolute',
    width: '90%',
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textTransform: 'uppercase',
    fontFamily: Platform.select({
      ios: 'Impact',
      android: 'sans-serif-black',
      default: 'Arial'
    }),
    textShadowColor: 'black',
    textShadowOffset: { width: -2, height: -2 },
    textShadowRadius: 0,
    letterSpacing: 1,
    zIndex: 1,
    left: '5%',
    right: '5%',
    paddingHorizontal: 10,
  },
  topText: {
    top: '2%',
  },
  bottomText: {
    bottom: '2%',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5
  },
});