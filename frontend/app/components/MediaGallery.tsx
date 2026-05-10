import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

import ThemedText from './ThemedText';
import api from '../api';
import { MediaAsset } from '../api/media';

type Props = {
  parent: { kind: 'work_order'; id: string } | { kind: 'vehicle'; id: string };
  title?: string;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.9,
  allowsEditing: false,
};

export default function MediaGallery({ parent, title = 'Photos' }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchAssets = async () => {
    try {
      const list =
        parent.kind === 'work_order'
          ? await api.media.listWorkOrderPhotos(parent.id)
          : await api.media.listVehicleReminders(parent.id);
      setAssets(list);
    } catch (err: any) {
      console.warn('Failed to load photos:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [parent.id]);

  const pickAndUpload = async (source: 'library' | 'camera') => {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;

    const a = result.assets[0];
    const name = a.fileName ?? a.uri.split('/').pop() ?? 'photo.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const file = { uri: a.uri, name, type };

    setUploading(true);
    try {
      const created =
        parent.kind === 'work_order'
          ? await api.media.uploadWorkOrderPhoto(parent.id, file)
          : await api.media.uploadVehicleReminder(parent.id, file);
      setAssets((prev) => [...prev, created]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = (asset: MediaAsset) => {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.media.remove(asset.id);
            setAssets((prev) => prev.filter((p) => p.id !== asset.id));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete photo.');
          }
        },
      },
    ]);
  };

  const openAddSheet = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert('Add photo', undefined, [
        { text: 'Take photo', onPress: () => pickAndUpload('camera') },
        { text: 'Choose from library', onPress: () => pickAndUpload('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      pickAndUpload('library');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={openAddSheet} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <FontAwesome5 name="plus" size={12} color="#fff" />
              <ThemedText style={styles.addText}>Add</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : assets.length === 0 ? (
        <ThemedText style={styles.empty}>No photos yet.</ThemedText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {assets.map((asset) => (
            <Pressable
              key={asset.id}
              onPress={() => setPreviewUrl(asset.url)}
              onLongPress={() => confirmDelete(asset)}
              style={styles.tile}
            >
              <Image source={{ uri: asset.url }} style={styles.thumb} />
              <TouchableOpacity style={styles.deleteBadge} onPress={() => confirmDelete(asset)}>
                <MaterialIcons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl && <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0a7ea4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { color: '#888', fontStyle: 'italic', paddingVertical: 8 },
  row: { gap: 8, paddingVertical: 4 },
  tile: { position: 'relative' },
  thumb: { width: 96, height: 96, borderRadius: 6, backgroundColor: '#eee' },
  deleteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '95%', height: '85%' },
});
