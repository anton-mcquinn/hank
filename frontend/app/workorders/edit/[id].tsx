// frontend/app/workorders/edit/[id].tsx
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
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

import ThemedText from "../../components/ThemedText";
import ThemedView from "../../components/ThemedView";
import api from "../../api";
import { Customer, Vehicle, WorkOrder, LineItem } from "../../api/types";

export default function EditWorkOrderScreen() {
  const { id } = useLocalSearchParams();
  const workOrderId = id as string;
  
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  const [workSummary, setWorkSummary] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [totalParts, setTotalParts] = useState<number>(0);
  const [totalLabor, setTotalLabor] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [status, setStatus] = useState<string>("draft");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([]);

  // Status options for dropdown
  const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Pending", value: "pending" },
    { label: "Processed", value: "processed" },
    { label: "Needs Review", value: "needs_review" },
    { label: "Estimated", value: "estimated" },
    { label: "Invoiced", value: "invoiced" }
  ];

  useEffect(() => {
    loadWorkOrderData();
    loadCustomers();
  }, [workOrderId]);

  useEffect(() => {
    // Calculate totals whenever line items change
    calculateTotals();
  }, [lineItems]);

  useEffect(() => {
    // Load customer's vehicles when customer changes
    if (customer) {
      loadCustomerVehicles(customer.id);
    }
  }, [customer]);

  const loadWorkOrderData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load work order details
      const workOrderData = await api.workorders.getById(workOrderId);
      setWorkOrder(workOrderData);
      
      // Set form values from work order data
      setWorkSummary(workOrderData.work_summary || "");
      setLineItems(workOrderData.line_items || []);
      setTotalParts(workOrderData.total_parts || 0);
      setTotalLabor(workOrderData.total_labor || 0);
      setTotal(workOrderData.total || 0);
      setStatus(workOrderData.status || "draft");
      
      // If we have customer and vehicle info in the work order response, use it
      if (workOrderData.customer) {
        setCustomer(workOrderData.customer);
      } else if (workOrderData.customer_id) {
        // Otherwise, fetch the customer if we have the ID
        try {
          const customerData = await api.customers.getById(workOrderData.customer_id);
          setCustomer(customerData);
        } catch (err) {
          console.warn("Could not load customer data:", err);
        }
      }
      
      // Same for vehicle
      if (workOrderData.vehicle) {
        setVehicle(workOrderData.vehicle);
      } else if (workOrderData.vehicle_id) {
        try {
          const vehicleData = await api.vehicles.getById(workOrderData.vehicle_id);
          setVehicle(vehicleData);
        } catch (err) {
          console.warn("Could not load vehicle data:", err);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load work order data");
      console.error("Error loading work order data:", err);
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

  const loadCustomerVehicles = async (customerId: string) => {
    try {
      const data = await api.vehicles.getByCustomer(customerId);
      setCustomerVehicles(data);
    } catch (err) {
      console.error("Error loading customer vehicles:", err);
    }
  };

  const calculateTotals = () => {
    // Calculate parts total
    const partsTotal = lineItems
      .filter(item => item.type === 'part')
      .reduce((sum, item) => sum + item.total, 0);
    
    // Calculate labor total
    const laborTotal = lineItems
      .filter(item => item.type === 'labor')
      .reduce((sum, item) => sum + item.total, 0);
    
    // Set state
    setTotalParts(partsTotal);
    setTotalLabor(laborTotal);
    setTotal(partsTotal + laborTotal);
  };

  const handleAddLineItem = () => {
    // Add a new empty line item
    const newItem: LineItem = {
      description: "New Item",
      type: "part",
      quantity: 1,
      unit_price: 0,
      total: 0
    };
    
    setLineItems([...lineItems, newItem]);
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    
    // Update the specified field
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    // If quantity or unit_price changes, recalculate the total for this item
    if (field === 'quantity' || field === 'unit_price') {
      const qty = field === 'quantity' ? value : updatedItems[index].quantity;
      const price = field === 'unit_price' ? value : updatedItems[index].unit_price;
      updatedItems[index].total = qty * price;
    }
    
    setLineItems(updatedItems);
  };

  const handleRemoveLineItem = (index: number) => {
    const updatedItems = lineItems.filter((_, i) => i !== index);
    setLineItems(updatedItems);
  };

  const handleChangeStatus = (newStatus: string) => {
    setStatus(newStatus);
  };

  const handleSelectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer);
    setShowCustomerSelector(false);
    
    // If customer changes, clear vehicle selection
    if (!vehicle || vehicle.customer_id !== selectedCustomer.id) {
      setVehicle(null);
    }
  };

  const handleSelectVehicle = (selectedVehicle: Vehicle) => {
    setVehicle(selectedVehicle);
    setShowVehicleSelector(false);
  };

  const handleSave = async () => {
    if (!workOrder) return;
    
    setSaving(true);
    try {
      const updateData = {
        customer_id: customer?.id,
        vehicle_id: vehicle?.id,
        work_summary: workSummary,
        line_items: lineItems,
        total_parts: totalParts,
        total_labor: totalLabor,
        total: total,
        status: status
      };
      
      await api.workorders.update(workOrderId, updateData);
      Alert.alert(
        "Success",
        "Work order updated successfully",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update work order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading work order data...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={loadWorkOrderData}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!workOrder) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText>Work order not found</ThemedText>
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
        <ThemedText type="defaultSemiBold">Select Customer</ThemedText>
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
          router.push("/customers/new?returnTo=workorders/edit/" + workOrderId);
        }}
      >
        <ThemedText style={styles.newButtonText}>+ Create New Customer</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  // Render the vehicle selector
  const renderVehicleSelector = () => (
    <ThemedView style={styles.selectorModal}>
      <ThemedView style={styles.selectorHeader}>
        <ThemedText type="defaultSemiBold">Select Vehicle</ThemedText>
        <TouchableOpacity onPress={() => setShowVehicleSelector(false)}>
          <MaterialIcons name="close" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </ThemedView>
      
      <ScrollView style={styles.selectorList}>
        {customerVehicles.length === 0 ? (
          <ThemedText style={styles.emptyText}>No vehicles found for this customer</ThemedText>
        ) : (
          customerVehicles.map(vehicle => (
            <TouchableOpacity 
              key={vehicle.id}
              style={styles.selectorItem}
              onPress={() => handleSelectVehicle(vehicle)}
            >
              <ThemedText type="defaultSemiBold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </ThemedText>
              <ThemedText>{vehicle.vin}</ThemedText>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.newButton}
        onPress={() => {
          setShowVehicleSelector(false);
          router.push(`/vehicles/new?customerId=${customer?.id}&returnTo=workorders/edit/${workOrderId}`);
        }}
      >
        <ThemedText style={styles.newButtonText}>+ Add New Vehicle</ThemedText>
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
          title: `Edit Work Order #${workOrderId.slice(0, 8)}`,
          headerBackTitle: "Back",
        }} 
      />
      
      <Pressable style={styles.container} onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Dropdown */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Status</ThemedText>
          <ThemedView style={styles.statusContainer}>
            {statusOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  status === option.value && styles.statusOptionSelected,
                  { backgroundColor: getStatusColor(option.value) }
                ]}
                onPress={() => handleChangeStatus(option.value)}
              >
                <ThemedText style={styles.statusOptionText}>
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        </ThemedView>
        
        {/* Customer Selector */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Customer Information</ThemedText>
          
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
                Select a customer...
              </ThemedText>
            )}
            <MaterialIcons name="edit" size={20} color="#0a7ea4" />
          </TouchableOpacity>
        </ThemedView>
        
        {/* Vehicle Selector (only show if customer is selected) */}
        {customer && (
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">Vehicle Information</ThemedText>
            
            <TouchableOpacity 
              style={styles.selectorBox}
              onPress={() => setShowVehicleSelector(true)}
            >
              {vehicle ? (
                <>
                  <ThemedText type="defaultSemiBold">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </ThemedText>
                  <ThemedText>VIN: {vehicle.vin || 'N/A'}</ThemedText>
                  <ThemedText>Mileage: {vehicle.mileage ? vehicle.mileage.toLocaleString() : 'N/A'}</ThemedText>
                </>
              ) : (
                <ThemedText style={styles.placeholderText}>
                  Select a vehicle...
                </ThemedText>
              )}
              <MaterialIcons name="edit" size={20} color="#0a7ea4" />
            </TouchableOpacity>
          </ThemedView>
        )}
        
        {/* Work Summary Editor */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Work Summary</ThemedText>
          
          <TextInput
            style={styles.summaryInput}
            multiline
            value={workSummary}
            onChangeText={setWorkSummary}
            placeholder="Enter work summary..."
            placeholderTextColor="#999"
          />
        </ThemedView>
        
        {/* Line Items Editor */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Line Items</ThemedText>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleAddLineItem}
            >
              <ThemedText style={styles.addButtonText}>+ Add Item</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          {lineItems.length === 0 ? (
            <ThemedText style={styles.emptyText}>No line items added</ThemedText>
          ) : (
            lineItems.map((item, index) => (
              <ThemedView key={index} style={styles.lineItemCard}>
                {/* Description */}
                <TextInput
                  style={styles.descriptionInput}
                  value={item.description}
                  onChangeText={(value) => handleUpdateLineItem(index, 'description', value)}
                  placeholder="Item description"
                  placeholderTextColor="#999"
                />
                
                {/* Type Selector */}
                <ThemedView style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      item.type === 'part' && styles.typeOptionSelected
                    ]}
                    onPress={() => handleUpdateLineItem(index, 'type', 'part')}
                  >
                    <ThemedText style={item.type === 'part' ? styles.typeTextSelected : styles.typeText}>
                      Part
                    </ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      item.type === 'labor' && styles.typeOptionSelected
                    ]}
                    onPress={() => handleUpdateLineItem(index, 'type', 'labor')}
                  >
                    <ThemedText style={item.type === 'labor' ? styles.typeTextSelected : styles.typeText}>
                      Labor
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
                
                {/* Quantity and Price Row */}
                <ThemedView style={styles.quantityPriceRow}>
                  <ThemedView style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Quantity</ThemedText>
                    <TextInput
                      style={styles.numberInput}
                      value={item.quantity.toString()}
                      onChangeText={(value) => {
                        const numValue = parseFloat(value) || 0;
                        handleUpdateLineItem(index, 'quantity', numValue);
                      }}
                      keyboardType="numeric"
                    />
                  </ThemedView>
                  
                  <ThemedView style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Unit Price ($)</ThemedText>
                    <TextInput
                      style={styles.numberInput}
                      value={item.unit_price.toString()}
                      onChangeText={(value) => {
                        const numValue = parseFloat(value) || 0;
                        handleUpdateLineItem(index, 'unit_price', numValue);
                      }}
                      keyboardType="numeric"
                    />
                  </ThemedView>
                  
                  <ThemedView style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Total</ThemedText>
                    <ThemedText style={styles.totalText}>
                      ${item.total.toFixed(2)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
                
                {/* Delete Button */}
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => handleRemoveLineItem(index)}
                >
                  <FontAwesome5 name="trash" size={16} color="white" />
                  <ThemedText style={styles.deleteItemText}>Remove</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ))
          )}
          
          {/* Totals */}
          {lineItems.length > 0 && (
            <ThemedView style={styles.totalsCard}>
              <ThemedView style={styles.totalRow}>
                <ThemedText>Parts Total:</ThemedText>
                <ThemedText>${totalParts.toFixed(2)}</ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.totalRow}>
                <ThemedText>Labor Total:</ThemedText>
                <ThemedText>${totalLabor.toFixed(2)}</ThemedText>
              </ThemedView>
              
              <ThemedView style={[styles.totalRow, styles.grandTotalRow]}>
                <ThemedText type="defaultSemiBold">GRAND TOTAL:</ThemedText>
                <ThemedText type="defaultSemiBold">${total.toFixed(2)}</ThemedText>
              </ThemedView>
            </ThemedView>
          )}
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

      {/* Selector Modals */}
      {showCustomerSelector && renderCustomerSelector()}
      {showVehicleSelector && renderVehicleSelector()}
    </KeyboardAvoidingView>
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
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  statusOptionSelected: {
    borderWidth: 2,
    borderColor: "#000",
  },
  statusOptionText: {
    color: "white",
    fontWeight: "600",
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
  summaryInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    marginTop: 8,
    textAlignVertical: "top",
  },
  lineItemCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  descriptionInput: {
    fontSize: 16,
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 4,
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 12,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    borderRadius: 4,
    marginRight: 8,
  },
  typeOptionSelected: {
    backgroundColor: "#0a7ea4",
  },
  typeText: {
    color: "#333",
    fontWeight: "600",
  },
  typeTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  quantityPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  inputLabel: {
    marginBottom: 4,
    fontSize: 12,
  },
  numberInput: {
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  totalText: {
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 8,
  },
  deleteItemButton: {
    marginTop: 12,
    backgroundColor: "#ff3b30",
    padding: 8,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteItemText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  totalsCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    marginTop: 8,
    paddingTop: 8,
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
  addButton: {
    backgroundColor: "#0a7ea4",
    padding: 8,
    borderRadius: 4,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
  },
  emptyText: {
    fontStyle: "italic",
    color: "#999",
    marginTop: 8,
    marginBottom: 8,
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
