// frontend/app/customers/edit/[id].tsx
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";

import ThemedText from "../../components/ThemedText";
import ThemedView from "../../components/ThemedView";
import api from "../../api";
import { CustomerUpdate } from "../../api/types";

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams();
  const customerId = id as string;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    setLoading(true);
    setError(null);
    try {
      const customer = await api.customers.getById(customerId);
      setFirstName(customer.first_name || "");
      setLastName(customer.last_name || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
      setAddress(customer.address || "");
    } catch (err: any) {
      setError(err.message || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () =>
    firstName.trim() !== "" && lastName.trim() !== "" && email.trim() !== "";

  const handleSave = async () => {
    if (!isFormValid()) {
      Alert.alert("Invalid Form", "Please fill out all required fields.");
      return;
    }

    setSaving(true);
    try {
      const updateData: CustomerUpdate = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address,
      };
      await api.customers.update(customerId, updateData);
      Alert.alert("Success", "Customer updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading customer...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={loadCustomer}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Stack.Screen options={{ title: "Edit Customer", headerBackTitle: "Back" }} />
      <Pressable style={styles.container} onPress={Keyboard.dismiss}>
        <ThemedView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText style={styles.label}>First Name *</ThemedText>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              autoCapitalize="words"
              editable={!saving}
            />

            <ThemedText style={styles.label}>Last Name *</ThemedText>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Doe"
              autoCapitalize="words"
              editable={!saving}
            />

            <ThemedText style={styles.label}>Email *</ThemedText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="john.doe@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />

            <ThemedText style={styles.label}>Phone</ThemedText>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(123) 456-7890"
              keyboardType="phone-pad"
              editable={!saving}
            />

            <ThemedText style={styles.label}>Address</ThemedText>
            <TextInput
              style={[styles.input, styles.addressInput]}
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St, Anytown, USA"
              multiline
              editable={!saving}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isFormValid() || saving) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={!isFormValid() || saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={saving}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </ThemedView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: { marginBottom: 4, marginTop: 16 },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  addressInput: { height: 80, textAlignVertical: "top" },
  saveButton: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  disabledButton: { backgroundColor: "#cccccc" },
  saveButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: { color: "#0a7ea4", fontWeight: "600", fontSize: 16 },
  loadingText: { marginTop: 8 },
  errorText: { color: "red", marginBottom: 16 },
  retryButton: {
    padding: 12,
    backgroundColor: "#0a7ea4",
    borderRadius: 4,
  },
  retryText: { color: "white" },
});
