// src/services/photoService.ts
// Profile photo upload/delete using Firebase Storage + expo-image-picker

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db, COLLECTIONS } from './firebase';

export type UploadProgress = (progress: number) => void; // 0-100

// ─── Pick an image from camera roll ──────────────────────────────────────────
export async function pickProfilePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4],       // portrait crop — good for profile cards
    quality: 0.8,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

// ─── Take a photo with camera ─────────────────────────────────────────────────
export async function takeProfilePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

// ─── Upload photo to Firebase Storage ────────────────────────────────────────
// Returns the public download URL
export async function uploadProfilePhoto(
  userId: string,
  localUri: string,
  photoIndex: number,          // 0, 1, or 2 (up to 3 photos per profile)
  onProgress?: UploadProgress,
): Promise<string> {
  // Convert local URI to blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  // Storage path: users/{userId}/photos/photo_{index}.jpg
  const storagePath = `users/${userId}/photos/photo_${photoIndex}.jpg`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadUrl);
      },
    );
  });
}

// ─── Save updated photos array to Firestore ───────────────────────────────────
export async function saveUserPhotos(userId: string, photoUrls: string[]): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
    photos: photoUrls,
    updatedAt: Date.now(),
  });
}

// ─── Delete a photo from Storage ──────────────────────────────────────────────
export async function deleteProfilePhoto(userId: string, photoIndex: number): Promise<void> {
  const storagePath = `users/${userId}/photos/photo_${photoIndex}.jpg`;
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (err: any) {
    // If file doesn't exist, that's fine
    if (err.code !== 'storage/object-not-found') throw err;
  }
}

// ─── Full flow: pick + upload + save ─────────────────────────────────────────
export async function replaceProfilePhoto(
  userId: string,
  currentPhotos: string[],
  photoIndex: number,
  source: 'gallery' | 'camera' = 'gallery',
  onProgress?: UploadProgress,
): Promise<string[]> {
  const localUri = source === 'camera'
    ? await takeProfilePhoto()
    : await pickProfilePhoto();

  if (!localUri) return currentPhotos; // user cancelled

  const downloadUrl = await uploadProfilePhoto(userId, localUri, photoIndex, onProgress);

  const updatedPhotos = [...currentPhotos];
  updatedPhotos[photoIndex] = downloadUrl;

  await saveUserPhotos(userId, updatedPhotos);
  return updatedPhotos;
}
// ─── Convenience wrappers (used by screen imports) ───────────────────────────

/**
 * Pick a photo from gallery, upload it, and return the download URL.
 * Screens call this as: pickAndUploadPhoto(userId, photoIndexOrName, onProgress?)
 */
export async function pickAndUploadPhoto(
  userId: string,
  photoIndexOrName: number | string,
  onProgress?: UploadProgress,
): Promise<string | null> {
  const localUri = await pickProfilePhoto();
  if (!localUri) return null;

  const photoIndex = typeof photoIndexOrName === 'number'
    ? photoIndexOrName
    : parseInt(String(photoIndexOrName).replace(/\D/g, '') || '0', 10);

  const downloadUrl = await uploadProfilePhoto(userId, localUri, photoIndex, onProgress);
  return downloadUrl;
}

/**
 * Delete a photo. Accepts either a download URL or falls back gracefully.
 */
export async function deletePhoto(photoUrlOrPath: string): Promise<void> {
  try {
    // Try to create a ref from the full URL (works with gs:// URLs and storage paths)
    const storageRef = ref(storage, photoUrlOrPath);
    await deleteObject(storageRef);
  } catch (err: any) {
    // If it's a download URL (https://firebasestorage...) we can't directly ref it,
    // so just log and move on — the storage object will be cleaned up by lifecycle rules
    if (err.code !== 'storage/object-not-found') {
      console.warn('deletePhoto: could not delete, skipping:', err.message);
    }
  }
}
