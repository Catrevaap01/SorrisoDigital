/**
 * Operações de upload/download para Supabase Storage
 */

// legacy import used to avoid deprecation warnings
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';
import { generateFileName } from '../utils/helpers';
import { HandledError, handleError } from '../utils/errorHandler';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export const uploadImage = async (
  uri: string,
  userId: string,
  bucket = 'triagens'
): Promise<UploadResult> => {
  try {
    const fileExtension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = generateFileName(userId, fileExtension);

    let bytes: Uint8Array;

    if (typeof window !== 'undefined' && uri.startsWith('blob:')) {
      // Web: fetch the blob URI directly
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    } else if (typeof window !== 'undefined' && uri.startsWith('data:')) {
      // Web: data URI (base64)
      const base64 = uri.split(',')[1];
      const binaryString = atob(base64);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      // Native: use expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as any,
      });
      const binaryString = atob(base64);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path || fileName);

    return { success: true, url: publicUrl, path: data.path };
  } catch (err) {
    const handled = handleError(err, 'storageService.uploadImage');
    console.error(handled);
    return { success: false, error: handled.message };
  }
};

export const uploadMultipleImages = async (
  uris: string[],
  userId: string,
  bucket = 'triagens'
): Promise<string[]> => {
  const results: string[] = [];
  for (const uri of uris) {
    const res = await uploadImage(uri, userId, bucket);
    if (res.success && res.url) {
      results.push(res.url);
    }
  }
  return results;
};

export const deleteImage = async (
  path: string,
  bucket = 'triagens'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as any).message };
  }
};
