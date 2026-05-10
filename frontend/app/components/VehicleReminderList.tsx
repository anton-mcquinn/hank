import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

import ThemedText from './ThemedText';
import api from '../api';
import { VehicleReminder } from '../api/reminders';

type Props = { vehicleId: string };

export default function VehicleReminderList({ vehicleId }: Props) {
  const [reminders, setReminders] = useState<VehicleReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [active, setActive] = useState<VehicleReminder | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Add form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);

  const fetchReminders = async () => {
    try {
      const list = await api.reminders.list(vehicleId);
      setReminders(list);
    } catch (err: any) {
      console.warn('Failed to load reminders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [vehicleId]);

  const resetForm = () => {
    setTitle('');
    setBody('');
    setPhoto(null);
  };

  const closeAdd = () => {
    setShowAdd(false);
    resetForm();
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const name = a.fileName ?? a.uri.split('/').pop() ?? 'photo.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    setPhoto({ uri: a.uri, name, type });
  };

  const openPhotoSheet = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert('Attach photo', undefined, [
        { text: 'Take photo', onPress: () => pickPhoto('camera') },
        { text: 'Choose from library', onPress: () => pickPhoto('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      pickPhoto('library');
    }
  };

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give the reminder a short title.');
      return;
    }
    setCreating(true);
    try {
      const created = await api.reminders.create(vehicleId, {
        title: trimmed,
        body: body.trim() || undefined,
        photo: photo || undefined,
      });
      setReminders((prev) => [...prev, created]);
      closeAdd();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save reminder.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (r: VehicleReminder) => {
    Alert.alert('Delete reminder?', `"${r.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.reminders.remove(vehicleId, r.id);
            setReminders((prev) => prev.filter((x) => x.id !== r.id));
            setActive(null);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete reminder.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Reminders</ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
          <FontAwesome5 name="plus" size={12} color="#fff" />
          <ThemedText style={styles.addText}>Add</ThemedText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : reminders.length === 0 ? (
        <ThemedText style={styles.empty}>No reminders yet.</ThemedText>
      ) : (
        <View style={styles.list}>
          {reminders.map((r) => (
            <TouchableOpacity key={r.id} style={styles.listItem} onPress={() => setActive(r)}>
              <View style={styles.listText}>
                <ThemedText style={styles.listTitle}>{r.title}</ThemedText>
                {r.photo_url && (
                  <View style={styles.paperclipRow}>
                    <FontAwesome5 name="paperclip" size={11} color="#888" />
                    <ThemedText style={styles.paperclipText}>Photo attached</ThemedText>
                  </View>
                )}
              </View>
              <FontAwesome5 name="chevron-right" size={12} color="#999" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Detail modal */}
      <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActive(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActive(null)}>
              <ThemedText style={styles.modalClose}>Close</ThemedText>
            </TouchableOpacity>
            {active && (
              <TouchableOpacity onPress={() => handleDelete(active)}>
                <ThemedText style={styles.modalDelete}>Delete</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {active && (
              <>
                <ThemedText style={styles.detailTitle}>{active.title}</ThemedText>
                {active.body ? (
                  <ThemedText style={styles.detailBody}>{active.body}</ThemedText>
                ) : (
                  <ThemedText style={styles.detailBodyEmpty}>(No additional details)</ThemedText>
                )}
                {active.photo_url && (
                  <Pressable onPress={() => setPreviewUrl(active.photo_url!)}>
                    <Image source={{ uri: active.photo_url }} style={styles.detailPhoto} />
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAdd}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeAdd} disabled={creating}>
              <ThemedText style={styles.modalClose}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={creating || !title.trim()}>
              {creating ? (
                <ActivityIndicator size="small" color="#0a7ea4" />
              ) : (
                <ThemedText style={[styles.modalSave, !title.trim() && styles.modalSaveDisabled]}>
                  Save
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <ThemedText style={styles.label}>Title</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Hard to access oil filter"
              placeholderTextColor="#999"
              autoFocus
            />
            <ThemedText style={styles.label}>Details (optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={body}
              onChangeText={setBody}
              placeholder="Anything else to remember?"
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.photoBlock}>
              {photo ? (
                <View style={styles.photoPreviewRow}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <TouchableOpacity onPress={() => setPhoto(null)}>
                    <ThemedText style={styles.removePhotoText}>Remove photo</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachButton} onPress={openPhotoSheet}>
                  <FontAwesome5 name="paperclip" size={14} color="#0a7ea4" />
                  <ThemedText style={styles.attachText}>Attach photo (optional)</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Fullscreen photo preview */}
      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl && <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
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
  list: { gap: 4 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  listText: { flex: 1 },
  listTitle: { fontSize: 15 },
  paperclipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  paperclipText: { fontSize: 12, color: '#888' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modalClose: { color: '#0a7ea4', fontSize: 16 },
  modalSave: { color: '#0a7ea4', fontSize: 16, fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.4 },
  modalDelete: { color: '#d0021b', fontSize: 16 },
  modalContent: { padding: 16, paddingBottom: 40 },

  detailTitle: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  detailBody: { fontSize: 16, lineHeight: 22, marginBottom: 16 },
  detailBodyEmpty: { fontSize: 14, fontStyle: 'italic', color: '#888', marginBottom: 16 },
  detailPhoto: { width: '100%', aspectRatio: 1.5, borderRadius: 8, backgroundColor: '#eee' },

  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6, opacity: 0.7 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },

  photoBlock: { marginTop: 16 },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0a7ea4',
    borderRadius: 8,
    justifyContent: 'center',
  },
  attachText: { color: '#0a7ea4', fontWeight: '600' },
  photoPreviewRow: { gap: 8 },
  photoPreview: { width: '100%', aspectRatio: 1.5, borderRadius: 8, backgroundColor: '#eee' },
  removePhotoText: { color: '#d0021b', fontWeight: '600', textAlign: 'center', paddingVertical: 6 },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '95%', height: '85%' },
});
