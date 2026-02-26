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
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });

    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    const fileName = generateFileName(userId, fileExtension);

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes.buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName);

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
