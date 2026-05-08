// frontend/app/vehicles/edit/[id].tsx
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { MaterialIcons } from '@expo/vector-icons';

import ThemedText from "../../components/ThemedText";
import ThemedView from "../../components/ThemedView";
import api from "../../api";
import { Customer, Vehicle, VehicleUpdate } from "../../api/types";

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams();
  const vehicleId = id as string;
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Form fields
  const [vin, setVin] = useState<string>("");
  const [plate, setPlate] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
  const [engineCode, setEngineCode] = useState<string>("");
  const [engineSize, setEngineSize] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);

  useEffect(() => {
    loadVehicleData();
    loadCustomers();
  }, [vehicleId]);

  const loadVehicleData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load vehicle details
      const vehicleData = await api.vehicles.getById(vehicleId);
      setVehicle(vehicleData);
      
      // Set form values from vehicle data
      setVin(vehicleData.vin || "");
      setPlate(vehicleData.plate || "");
      setYear(vehicleData.year ? vehicleData.year.toString() : "");
      setMake(vehicleData.make || "");
      setModel(vehicleData.model || "");
      setMileage(vehicleData.mileage ? vehicleData.mileage.toString() : "");
      setEngineCode(vehicleData.engine_code || "");
      setEngineSize(vehicleData.engine_size || "");
      
      // Load owner (customer) details
      if (vehicleData.customer_id) {
        try {
          const customerData = await api.customers.getById(vehicleData.customer_id);
          setCustomer(customerData);
        } catch (err) {
          console.warn("Could not load customer data:", err);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load vehicle data");
      console.error("Error loading vehicle data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await api.customers.getAll();
      setCustomers(data);
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  };

  const handleSelectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer);
    setShowCustomerSelector(false);
  };

  const handleDecodeVin = async () => {
    if (!vin || vin.length !== 17) {
      Alert.alert("Invalid VIN", "Please enter a valid 17-character VIN");
      return;
    }
    
    try {
      // This is a placeholder - you would need to create this API endpoint
      // to decode VINs from the frontend directly
      Alert.alert("VIN Decoding", "Decoding service connected to backend will be added in a future update");
      
      // For now, we can manually check with NHTSA service and update form fields
      // In a production app, we would make an API call to our backend VIN decoding service
    } catch (err: any) {
      Alert.alert("VIN Decoding Error", err.message || "Failed to decode VIN");
    }
  };

  const handleSave = async () => {
    if (!vehicle || !customer) {
      Alert.alert("Error", "Vehicle and customer information is required");
      return;
    }
    
    setSaving(true);
    try {
      const updateData: VehicleUpdate = {
        customer_id: customer.id,
        vin: vin || undefined,
        plate: plate || undefined,
        year: year ? parseInt(year) : undefined,
        make: make || undefined,
        model: model || undefined,
        mileage: mileage ? parseInt(mileage) : undefined,
        // These fields might need to be added to your VehicleUpdate model and API
        engine_code: engineCode || undefined,
        engine_size: engineSize || undefined
      };
      
      // Remove any undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      await api.vehicles.update(vehicleId, updateData);
      Alert.alert(
        "Success",
        "Vehicle updated successfully",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update vehicle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading vehicle data...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={loadVehicleData}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!vehicle) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText>Vehicle not found</ThemedText>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // Render the customer selector
  const renderCustomerSelector = () => (
    <ThemedView style={styles.selectorModal}>
      <ThemedView style={styles.selectorHeader}>
        <ThemedText type="defaultSemiBold">Select Owner</ThemedText>
        <TouchableOpacity onPress={() => setShowCustomerSelector(false)}>
          <MaterialIcons name="close" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </ThemedView>
      
      <ScrollView style={styles.selectorList}>
        {customers.map(customer => (
          <TouchableOpacity 
            key={customer.id}
            style={styles.selectorItem}
            onPress={() => handleSelectCustomer(customer)}
          >
            <ThemedText type="defaultSemiBold">
              {customer.first_name} {customer.last_name}
            </ThemedText>
            <ThemedText>{customer.phone}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.newButton}
        onPress={() => {
          setShowCustomerSelector(false);
          router.push("/customers/new?returnTo=vehicles/edit/" + vehicleId);
        }}
      >
        <ThemedText style={styles.newButtonText}>+ Create New Customer</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Stack.Screen 
        options={{ 
          title: "Edit Vehicle",
          headerBackTitle: "Back",
        }} 
      />
      
      <Pressable style={styles.container} onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer/Owner Selector */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Vehicle Owner</ThemedText>
          
          <TouchableOpacity 
            style={styles.selectorBox}
            onPress={() => setShowCustomerSelector(true)}
          >
            {customer ? (
              <>
                <ThemedText type="defaultSemiBold">
                  {customer.first_name} {customer.last_name}
                </ThemedText>
                <ThemedText>{customer.phone}</ThemedText>
                <ThemedText>{customer.email}</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.placeholderText}>
                Select an owner...
              </ThemedText>
            )}
            <MaterialIcons name="edit" size={20} color="#0a7ea4" />
          </TouchableOpacity>
        </ThemedView>
        
        {/* VIN Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Vehicle Identification</ThemedText>
            <TouchableOpacity 
              style={styles.decodeButton}
              onPress={handleDecodeVin}
              disabled={!vin || vin.length !== 17}
            >
              <ThemedText style={styles.decodeButtonText}>Decode VIN</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          <ThemedText style={styles.label}>VIN</ThemedText>
          <TextInput
            style={styles.input}
            value={vin}
            onChangeText={setVin}
            placeholder="17-character VIN"
            autoCapitalize="characters"
            maxLength={17}
          />
          
          <ThemedText style={styles.label}>License Plate</ThemedText>
          <TextInput
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder="License plate number"
            autoCapitalize="characters"
          />
        </ThemedView>
        
        {/* Vehicle Details Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Vehicle Details</ThemedText>
          
          <ThemedView style={styles.formRow}>
            <ThemedView style={styles.formColumn}>
              <ThemedText style={styles.label}>Year</ThemedText>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="Year"
                keyboardType="numeric"
                maxLength={4}
              />
            </ThemedView>
            
            <ThemedView style={styles.formColumn}>
              <ThemedText style={styles.label}>Make</ThemedText>
              <TextInput
                style={styles.input}
                value={make}
                onChangeText={setMake}
                placeholder="Make"
                autoCapitalize="words"
              />
            </ThemedView>
          </ThemedView>
          
          <ThemedText style={styles.label}>Model</ThemedText>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="Model"
            autoCapitalize="words"
          />
          
          <ThemedText style={styles.label}>Mileage</ThemedText>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            placeholder="Current mileage"
            keyboardType="numeric"
          />
        </ThemedView>
        
        {/* Engine Information Section */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Engine Information</ThemedText>
          
          <ThemedView style={styles.formRow}>
            <ThemedView style={styles.formColumn}>
              <ThemedText style={styles.label}>Engine Code</ThemedText>
              <TextInput
                style={styles.input}
                value={engineCode}
                onChangeText={setEngineCode}
                placeholder="Engine code"
                autoCapitalize="characters"
              />
            </ThemedView>
            
            <ThemedView style={styles.formColumn}>
              <ThemedText style={styles.label}>Engine Size</ThemedText>
              <TextInput
                style={styles.input}
                value={engineSize}
                onChangeText={setEngineSize}
                placeholder="e.g. 2.0L, 5.7L"
              />
            </ThemedView>
          </ThemedView>
        </ThemedView>
        
        {/* Save and Cancel Buttons */}
        <ThemedView style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
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
        </ThemedView>
      </ScrollView>
      </Pressable>

      {/* Customer Selector Modal */}
      {showCustomerSelector && renderCustomerSelector()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formColumn: {
    flex: 1,
    marginRight: 8,
  },
  formColumn2: {
    flex: 1,
    marginLeft: 8,
  },
  selectorBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  placeholderText: {
    color: "#999",
    fontStyle: "italic",
  },
  decodeButton: {
    backgroundColor: "#0a7ea4",
    padding: 8,
    borderRadius: 4,
  },
  decodeButtonText: {
    color: "white",
    fontWeight: "600",
  },
  actionButtons: {
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: "#4CD964",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 16,
  },
  loadingText: {
    marginTop: 8,
  },
  errorText: {
    color: "red",
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    backgroundColor: "#0a7ea4",
    borderRadius: 4,
  },
  retryText: {
    color: "white",
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#0a7ea4",
    borderRadius: 4,
  },
  backButtonText: {
    color: "white",
  },
  selectorModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    padding: 16,
    zIndex: 1000,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  selectorList: {
    flex: 1,
  },
  selectorItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  newButton: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  newButtonText: {
    color: "white",
    fontWeight: "600",
  },
});
