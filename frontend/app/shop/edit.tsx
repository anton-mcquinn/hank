import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';

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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.shop.getSettings()
      .then(setForm)
      .catch(() => Alert.alert('Error', 'Could not load shop settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.shop.updateSettings(form);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save shop settings.');
    } finally {
      setSaving(false);
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
});
