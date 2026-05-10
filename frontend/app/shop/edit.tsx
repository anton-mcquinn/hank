import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';

import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import api from '../api';
import { ShopSettings } from '../api/shop';

export default function ShopEditScreen() {
  const [form, setForm] = useState<ShopSettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    api.shop.getSettings()
      .then(setForm)
      .catch(() => Alert.alert('Error', 'Could not load shop settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Strip logo_url — it's a derived field, not user-editable.
      const { logo_url: _ignored, ...editable } = form;
      await api.shop.updateSettings(editable);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save shop settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const name = asset.fileName ?? uri.split('/').pop() ?? 'logo.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    setLogoBusy(true);
    try {
      const updated = await api.shop.uploadLogo({ uri, name, type } as any);
      setForm(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoBusy(true);
    try {
      const updated = await api.shop.deleteLogo();
      setForm(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Pressable style={styles.container} onPress={Keyboard.dismiss}>
        <ThemedView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoRow}>
              {form.logo_url ? (
                <Image source={{ uri: form.logo_url }} style={styles.logoPreview} />
              ) : (
                <View style={[styles.logoPreview, styles.logoPlaceholder]}>
                  <FontAwesome5 name="image" size={28} color="#aaa" />
                </View>
              )}
              <View style={styles.logoActions}>
                <TouchableOpacity style={styles.logoButton} onPress={handlePickLogo} disabled={logoBusy}>
                  {logoBusy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <ThemedText style={styles.logoButtonText}>
                      {form.logo_url ? 'Replace logo' : 'Upload logo'}
                    </ThemedText>
                  )}
                </TouchableOpacity>
                {form.logo_url && (
                  <TouchableOpacity onPress={handleRemoveLogo} disabled={logoBusy}>
                    <ThemedText style={styles.removeLogoText}>Remove</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Field label="Shop Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Your Shop Name" />
            <Field label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} placeholder="123 Main St, City, State" multiline />
            <Field label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="(555) 123-4567" keyboardType="phone-pad" />
            <Field label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="shop@example.com" keyboardType="email-address" />
            <Field label="Website" value={form.website} onChangeText={(v) => setForm({ ...form, website: v })} placeholder="www.yourshop.com" keyboardType="url" />

            <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.saveText}>Save</ThemedText>}
            </TouchableOpacity>
          </ScrollView>
        </ThemedView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, opacity: 0.7 },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: '#0a7ea4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoActions: {
    flex: 1,
    gap: 8,
  },
  logoButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoButtonText: { color: '#fff', fontWeight: '600' },
  removeLogoText: { color: '#d0021b', fontWeight: '600', textAlign: 'center', paddingVertical: 6 },
});
