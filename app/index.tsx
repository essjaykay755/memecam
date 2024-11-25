import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Image, 
  Text, 
  Platform, 
  ToastAndroid, 
  Animated,
  Modal,
  Linking,
  Pressable
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, CameraCapturedPicture, CameraMountError } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';
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

interface ToastState {
  visible: boolean;
  message: string;
}

export default function CameraScreen() {
  const [type, setType] = useState<CameraType>('back');
  const [flash, setFlash] = useState<boolean>(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [mode, setMode] = useState<CameraMode>('camera');
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [memeText, setMemeText] = useState<MemeText | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' });
  const cameraRef = useRef<CameraView>(null);
  const viewShotRef = useRef<View>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      setToast({ visible: true, message });
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast({ visible: false, message: '' });
      });
    }
  };

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
        const result = await cameraRef.current.takePictureAsync({
          quality: 1,
          skipProcessing: true
        });

        if (!result) {
          throw new Error('Failed to capture photo');
        }
        
        // Flip image if using front camera
        if (type === 'front') {
          const flippedPhoto = await manipulateAsync(
            result.uri,
            [{ flip: FlipType.Horizontal }],
            { compress: 1, format: SaveFormat.JPEG }
          );
          setCapturedImage(flippedPhoto.uri);
          setMode('preview');
          generateMemeText(flippedPhoto.uri);
        } else {
          setCapturedImage(result.uri);
          setMode('preview');
          generateMemeText(result.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        setError('Failed to take picture. Please try again.');
      }
    }
  };

  const generateMemeText = async (imageUri: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await analyzeMemeImage(imageUri);
      setMemeText(result);
    } catch (error) {
      console.error('Error generating meme:', error);
      if (error instanceof Error && error.message.includes('quota')) {
        setError('Oops! We\'ve hit our daily limit. Please try again in a few hours when our AI recharges. ');
      } else {
        setError('Failed to generate meme text. Please try again.');
      }
    } finally {
      setIsGenerating(false);
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
        showToast('Meme saved to gallery! ');
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        setCapturedImage(result.assets[0].uri);
        setMode('preview');
        await generateMemeText(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image from gallery. Please try again.');
    }
  };

  const toggleFlash = () => {
    setFlash(current => !current);
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  if (mode === 'preview' || mode === 'editing') {
    return (
      <ThemedView style={styles.container}>
        {Platform.OS === 'ios' && toast.visible && (
          <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        )}
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
              style={[styles.editButton, isSaving && styles.disabledButton]} 
              onPress={retryMeme}
              disabled={isSaving}
            >
              <View style={styles.buttonContent}>
                <IconSymbol name="arrow.triangle.2.circlepath" size={24} color="white" />
                <ThemedText style={styles.buttonText}>New Photo</ThemedText>
              </View>
            </TouchableOpacity>
            
            {memeText && !error && (
              <TouchableOpacity 
                style={[styles.editButton, styles.saveButton, isSaving && styles.disabledButton]} 
                onPress={saveMeme}
                disabled={isSaving}
              >
                <View style={styles.buttonContent}>
                  <IconSymbol 
                    name={isSaving ? "hourglass" : "square.and.arrow.down"} 
                    size={24} 
                    color="white" 
                  />
                  <ThemedText style={styles.buttonText}>
                    {isSaving ? 'Saving...' : 'Save Meme'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {Platform.OS === 'ios' && toast.visible && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
      <CameraView 
        ref={cameraRef} 
        style={styles.camera} 
        facing={type}
        enableTorch={flash}
        onMountError={(error: CameraMountError) => {
          console.error('Camera mount error:', error);
          setError('Failed to start camera. Please try again.');
        }}
      >
        <View style={styles.topControls}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={toggleFlash}
          >
            <IconSymbol 
              name={flash ? "bolt.fill" : "bolt.slash.fill"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => setInfoVisible(true)}
          >
            <IconSymbol 
              name="info.circle.fill" 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraControlsContainer}>
          <View style={styles.cameraControls}>
            <TouchableOpacity 
              style={styles.cameraButton} 
              onPress={openGallery}
            >
              <View style={styles.buttonContent}>
                <IconSymbol name="photo.on.rectangle" size={24} color="white" />
                <ThemedText style={styles.buttonText}>Gallery</ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cameraButton} 
              onPress={toggleCameraType}
            >
              <View style={styles.buttonContent}>
                <IconSymbol name="camera.rotate" size={24} color="white" />
                <ThemedText style={styles.buttonText}>Flip</ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={infoVisible}
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setInfoVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>MemeCam</Text>
            <Text style={styles.modalSubtitle}>A EssJayKay.dev Software</Text>
            
            <View style={styles.modalLinks}>
              <TouchableOpacity 
                onPress={() => openLink('https://essjaykay.dev')}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Official Website</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => openLink('https://memecam.essjaykay.dev')}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>App Website</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => openLink('https://github.com/essjaykay755')}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Developer: Subhojit Karmakar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cameraControlsContainer: {
    width: '100%',
    paddingBottom: Platform.select({ ios: 40, android: 20 }),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cameraButton: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#2C2C2E',
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
    textShadowRadius: 3,
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
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  editButton: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  saveButton: {
    backgroundColor: '#0A84FF',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.6,
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
  toast: {
    position: 'absolute',
    top: Platform.select({ ios: 50, default: 20 }),
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 8,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  topControls: {
    position: 'absolute',
    top: Platform.select({ ios: 50, default: 20 }),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 24,
  },
  modalLinks: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  linkButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    width: '100%',
  },
  linkText: {
    color: '#0A84FF',
    fontSize: 16,
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0A84FF',
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});