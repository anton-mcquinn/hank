// frontend/app/vehicles/[id].tsx
import React, { useEffect, useState } from "react";
import { StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert, View } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { FontAwesome5 } from '@expo/vector-icons';

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import VehicleReminderList from "../components/VehicleReminderList";
import api from "../api";
import { Customer, Vehicle, WorkOrder } from "../api/types";

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams();
  const vehicleId = id as string;
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVehicleData();
  }, [vehicleId]);

  const loadVehicleData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load vehicle details
      const vehicleData = await api.vehicles.getById(vehicleId);
      setVehicle(vehicleData);

      // Load owner (customer) details
      if (vehicleData.customer_id) {
        try {
          const customerData = await api.customers.getById(vehicleData.customer_id);
          setCustomer(customerData);
        } catch (err) {
          console.warn("Could not load customer data:", err);
        }
      }

      // Load work orders for this vehicle
      // Note: You might need to add an API endpoint for this if it doesn't exist
      try {
        const workOrdersData = await api.workorders.getAll();
        // Filter work orders for this vehicle
        const vehicleWorkOrders = workOrdersData.filter(wo => wo.vehicle_id === vehicleId);
        setWorkOrders(vehicleWorkOrders);
      } catch (err) {
        console.warn("Could not load work orders:", err);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load vehicle data");
      console.error("Error loading vehicle data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = () => {
    Alert.alert(
      "Delete Vehicle",
      "Are you sure you want to delete this vehicle? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.vehicles.delete(vehicleId);
              Alert.alert("Success", "Vehicle deleted successfully", [
                { text: "OK", onPress: () => router.back() }
              ]);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete vehicle");
            }
          }
        }
      ]
    );
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

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: vehicle.make && vehicle.model 
            ? `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}` 
            : "Vehicle Details",
          headerBackTitle: "Back",
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push(`/vehicles/edit/${vehicleId}`)}>
              <ThemedText style={styles.editButton}>Edit</ThemedText>
            </TouchableOpacity>
          )
        }} 
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle Info Section */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedText type="subtitle">Vehicle Information</ThemedText>
          
          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Year:</ThemedText>
              <ThemedText style={styles.infoValue}>{vehicle.year || 'Not specified'}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Make:</ThemedText>
              <ThemedText style={styles.infoValue}>{vehicle.make || 'Not specified'}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Model:</ThemedText>
              <ThemedText style={styles.infoValue}>{vehicle.model || 'Not specified'}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>VIN:</ThemedText>
              <ThemedText style={styles.infoValue}>{vehicle.vin || 'Not specified'}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>License Plate:</ThemedText>
              <ThemedText style={styles.infoValue}>{vehicle.plate || 'Not specified'}</ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Mileage:</ThemedText>
              <ThemedText style={styles.infoValue}>
                {vehicle.mileage ? vehicle.mileage.toLocaleString() : 'Not specified'}
              </ThemedText>
            </View>
            
            {/* Show engine information if available */}
            {vehicle.engine_code && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Engine Code:</ThemedText>
                <ThemedText style={styles.infoValue}>{vehicle.engine_code}</ThemedText>
              </View>
            )}
            
            {vehicle.engine_size && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Engine Size:</ThemedText>
                <ThemedText style={styles.infoValue}>{vehicle.engine_size}</ThemedText>
              </View>
            )}
          </View>

          <VehicleReminderList vehicleId={vehicleId} />
        </ThemedView>

        {/* Owner Information */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedText type="subtitle">Owner Information</ThemedText>
          
          {customer ? (
            <TouchableOpacity 
              style={styles.customerCard}
              onPress={() => router.push(`/customers/${customer.id}`)}
            >
              <ThemedText type="defaultSemiBold">{customer.first_name} {customer.last_name}</ThemedText>
              <ThemedText>{customer.phone}</ThemedText>
              <ThemedText>{customer.email}</ThemedText>
              <ThemedText>{customer.address}</ThemedText>
            </TouchableOpacity>
          ) : (
            <ThemedText style={styles.emptyText}>No owner information available</ThemedText>
          )}
        </ThemedView>
        
        {/* Work Order History */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Work Order History</ThemedText>
            <TouchableOpacity 
              onPress={() => router.push(`/workorders/new?vehicleId=${vehicleId}`)}
            >
              <ThemedText style={styles.addButton}>+ New Order</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          {workOrders.length === 0 ? (
            <ThemedText style={styles.emptyText}>No work orders found for this vehicle</ThemedText>
          ) : (
            workOrders.map(order => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.workOrderCard}
                onPress={() => router.push(`/workorders/${order.id}`)}
              >
                <ThemedView style={styles.workOrderHeader}>
                  <ThemedText type="defaultSemiBold">
                    Order #{order.id.slice(0, 8)}
                  </ThemedText>
                  <ThemedText style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}>
                    {order.status.toUpperCase()}
                  </ThemedText>
                </ThemedView>
                
                <ThemedText numberOfLines={2} style={styles.workSummary}>
                  {order.work_summary || "No work summary"}
                </ThemedText>
                
                <ThemedText style={styles.orderTotal}>
                  Total: ${order.total.toFixed(2)}
                </ThemedText>
              </TouchableOpacity>
            ))
          )}
        </ThemedView>
        
        {/* Delete Button */}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={handleDeleteVehicle}
        >
          <ThemedText style={styles.deleteButtonText}>Delete Vehicle</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

// Helper function to get color based on work order status
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'draft':
      return '#aaaaaa';
    case 'pending':
      return '#f5a623';
    case 'processed':
      return '#4a90e2';
    case 'invoiced':
      return '#7ed321';
    case 'estimated':
      return '#50e3c2';
    case 'needs_review':
      return '#ff9500';
    case 'error':
      return '#d0021b';
    default:
      return '#aaaaaa';
  }
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
    borderRadius: 8,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoRows: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: "600",
    width: 100,
  },
  infoValue: {
    flex: 1,
  },
  customerCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  workOrderCard: {
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 12,
  },
  workOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "white",
    overflow: "hidden",
  },
  workSummary: {
    marginBottom: 8,
  },
  orderTotal: {
    textAlign: "right",
    fontWeight: "600",
  },
  emptyText: {
    fontStyle: "italic",
    color: "#999999",
    marginTop: 8,
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
  editButton: {
    color: "#0a7ea4",
    fontSize: 16,
    fontWeight: "600",
    padding: 8,
  },
  addButton: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
