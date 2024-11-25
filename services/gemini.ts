import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('Missing Gemini API key. Please set EXPO_PUBLIC_GEMINI_API_KEY in your environment.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function analyzeMemeImage(imageUri: string): Promise<{ topText: string; bottomText: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // First resize the image to a smaller size
    const resizedImage = await manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: 512 // Smaller size for API
          }
        }
      ],
      { 
        format: SaveFormat.JPEG,
        compress: 0.8 // Reduce quality slightly
      }
    );
    
    // Read the resized image
    const base64 = await FileSystem.readAsStringAsync(resizedImage.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Ensure the image isn't too large (max 4MB)
    if (base64.length > 4 * 1024 * 1024) {
      throw new Error('Image too large. Please try a different image.');
    }

    const result = await model.generateContent([
      {
        text: "You are a creative meme generator. Create a funny and original two-part meme for this image. Be witty and avoid clichés like 'organized chaos'. The meme should tell a story or make a clever observation. Return ONLY the top and bottom text separated by '|' character. Each part can be up to 8 words but should be impactful. Focus on humor, originality, and relevance to the image content. Avoid repetitive phrases and generic observations. Do not include any other text or explanation."
      },
      {
        inlineData: {
          data: base64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    if (!text.includes('|')) {
      throw new Error('Invalid response format from Gemini API');
    }

    const [topText = '', bottomText = ''] = text.split('|').map(t => t.trim());

    if (!topText || !bottomText) {
      throw new Error('Empty response from Gemini API');
    }

    return { topText, bottomText };
  } catch (error) {
    console.error('Error analyzing image:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate meme: ${error.message}`);
    } else {
      throw new Error('Failed to generate meme: Unknown error');
    }
  }
}