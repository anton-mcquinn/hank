import React, { useEffect, useState } from "react";
import { StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert, View } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import PDFViewer from "../components/PDFViewer";
import api from "../api";
import { Customer, Vehicle, WorkOrder, LineItem } from "../api/types";

export default function WorkorderDetailScreen() {
  const { id } = useLocalSearchParams();
  const workOrderId = id as string;
  const needsManualReview = workOrder?.status === 'needs_review';
  const processingNotes = workOrder?.processing_notes || [];
  
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshTimer, setAutoRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [generating, setGenerating] = useState<"invoice" | "estimate" | null>(null);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");

  useEffect(() => {
    loadWorkOrderData();
  }, [workOrderId]);

  const loadWorkOrderData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load work order details
      const workOrderData = await api.workorders.getById(workOrderId);
      setWorkOrder(workOrderData);
      
      // Check if still processing and set up auto-refresh if needed
    if (workOrderData.status === 'processing') {
      // Clear any existing timer
      if (autoRefreshTimer) {
        clearTimeout(autoRefreshTimer);
      }
      
      // Set up a new timer to refresh every 5 seconds
      const timer = setTimeout(() => {
        loadWorkOrderData();
      }, 5000);
      
      setAutoRefreshTimer(timer);
    } else {
      // If no longer processing, clear any refresh timer
      if (autoRefreshTimer) {
        clearTimeout(autoRefreshTimer);
        setAutoRefreshTimer(null);
      }
    }
    
    // Existing code for loading customer and vehicle...
    if (workOrderData.customer) {
      setCustomer(workOrderData.customer);
    } else if (workOrderData.customer_id) {
      // ...
    }
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
  useEffect(() => {
  return () => {
    if (autoRefreshTimer) {
      clearTimeout(autoRefreshTimer);
    }
  };
}, [autoRefreshTimer]);
  const ProcessingStateIndicator = () => {
  return (
    <ThemedView 
      style={styles.processingContainer}
      lightColor="#f0f9ff"
      darkColor="#1a365d"
    >
      <ActivityIndicator size="large" color="#0a7ea4" />
      <ThemedText type="defaultSemiBold" style={styles.processingTitle}>
        Processing Media Files
      </ThemedText>
      <ThemedText style={styles.processingText}>
        We're analyzing your audio recordings and images to extract vehicle information 
        and generate a work summary. This may take a minute or two.
      </ThemedText>
      <ThemedText style={styles.processingSubtext}>
        You can continue using the app while processing completes. 
        The page will update automatically when ready.
      </ThemedText>
    </ThemedView>
  );
};

  const handleDeleteWorkOrder = () => {
    Alert.alert(
      "Delete Work Order",
      "Are you sure you want to delete this work order? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.workorders.delete(workOrderId);
              Alert.alert("Success", "Work order deleted successfully", [
                { text: "OK", onPress: () => router.back() }
              ]);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete work order");
            }
          }
        }
      ]
    );
  };

  const generateAndPreview = async (
    kind: "invoice" | "estimate",
  ) => {
    try {
      setGenerating(kind);
      const response =
        kind === "invoice"
          ? await api.invoices.generateInvoice(workOrderId, { generate_pdf: true, send_email: false })
          : await api.invoices.generateEstimate(workOrderId, { generate_pdf: true, send_email: false });

      if (!response.pdf_url) {
        throw new Error("No PDF URL returned");
      }

      setPdfTitle(`${kind === "invoice" ? "Invoice" : "Estimate"} #${workOrderId.slice(0, 8)}`);
      setCurrentPdfUrl(response.pdf_url);
      setPdfModalVisible(true);
      loadWorkOrderData();
    } catch (err: any) {
      Alert.alert("Error", err.message || `Failed to generate ${kind}`);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateInvoice = () => {
    Alert.alert(
      "Generate Invoice",
      "Do you want to generate an invoice for this work order?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Generate PDF", onPress: () => generateAndPreview("invoice") },
      ],
    );
  };

  const handleGenerateEstimate = () => {
    Alert.alert(
      "Generate Estimate",
      "Do you want to generate an estimate for this work order?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Generate PDF", onPress: () => generateAndPreview("estimate") },
      ],
    );
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

  // Get vehicle information from either the vehicle object or the vehicle_info
  const vehicleInfo = vehicle || workOrder.vehicle_info;
  const vehicleYear = vehicle?.year || workOrder.vehicle_info?.year;
  const vehicleMake = vehicle?.make || workOrder.vehicle_info?.make;
  const vehicleModel = vehicle?.model || workOrder.vehicle_info?.model;
  const vehicleVin = vehicle?.vin || workOrder.vehicle_info?.vin;
  const vehicleMileage = vehicle?.mileage || workOrder.vehicle_info?.mileage;
  
  // Get customer name
  const customerName = customer 
    ? `${customer.first_name} ${customer.last_name}`
    : workOrder.customer_id 
    ? "Loading customer..." 
    : "No customer assigned";

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: `Work Order #${workOrder.id.slice(0, 8)}`,
          headerBackTitle: "Back",
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push(`/workorders/edit/${workOrderId}`)}>
              <ThemedText style={styles.editButton}>Edit</ThemedText>
            </TouchableOpacity>
          )
        }} 
      />
      {workOrder && workOrder.status === 'processing' && (
        <ProcessingStateIndicator />
      )}
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Badge */}
        <ThemedView style={styles.statusContainer}>
          <ThemedText style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(workOrder.status) }
          ]}>
            {workOrder.status === 'processing' ? 'PROCESSING' :workOrder.status.toUpperCase()}
          </ThemedText>
        </ThemedView>
        
        {/* Customer Info Section */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedText type="subtitle">Customer Information</ThemedText>
          
          <TouchableOpacity 
            style={styles.infoCard}
            onPress={() => customer && router.push(`/customers/${customer.id}`)}
            disabled={!customer}
          >
            <ThemedText type="defaultSemiBold">{customerName}</ThemedText>
            
            {customer && (
              <>
                <ThemedText>{customer.phone}</ThemedText>
                <ThemedText>{customer.email}</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>

        {needsManualReview && (
          <ThemedView 
            style={styles.warningBanner}
            lightColor="#FFF3CD"
            darkColor="#554422"
          >
            <ThemedText type="defaultSemiBold" style={styles.warningTitle}>
              Manual Review Required
            </ThemedText>
            <ThemedText style={styles.warningText}>
              Some information couldn't be processed automatically. Please review and update the details as needed.
            </ThemedText>
            
            {processingNotes.length > 0 && (
              <ThemedView style={styles.notesContainer}>
                <ThemedText type="defaultSemiBold">Processing Notes:</ThemedText>
                {processingNotes.map((note, index) => (
                  <ThemedText key={index} style={styles.noteItem}>• {note}</ThemedText>
                ))}
              </ThemedView>
            )}
            
            <View style={styles.actionButtonsRow}>
              {!vehicle && (
                <TouchableOpacity 
                  style={styles.addVehicleButton}
                  onPress={() => router.push(`/vehicles/new?workOrderId=${workOrderId}&customerId=${workOrder.customer_id}`)}
                >
                  <ThemedText style={styles.actionButtonText}>Add Vehicle</ThemedText>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.warningActionButton}
                onPress={() => router.push(`/workorders/edit/${workOrderId}`)}
              >
                <ThemedText style={styles.actionButtonText}>Edit Details</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        )}
        
       {/* Vehicle Section */}
      <ThemedView 
        style={styles.section}
        lightColor="#ffffff"
        darkColor="#333333"
      >
        <ThemedText type="subtitle">Vehicle Information</ThemedText>
        
        {!vehicle && vehicleInfo && Object.keys(vehicleInfo).length === 0 ? (
          // No vehicle at all
          <ThemedView style={styles.emptyInfoCard}>
            <ThemedText style={styles.emptyText}>No vehicle information available</ThemedText>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push(`/vehicles/new?workOrderId=${workOrderId}&customerId=${workOrder.customer_id}`)}
            >
              <ThemedText style={styles.addButtonText}>+ Add Vehicle</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          // Vehicle or vehicle_info exists
          <TouchableOpacity 
            style={styles.infoCard}
            onPress={() => vehicle && router.push(`/vehicles/${vehicle.id}`)}
            disabled={!vehicle}
          >
            <View style={styles.vehicleHeader}>
              <ThemedText type="defaultSemiBold">
                {vehicleYear ? vehicleYear : '----'} {vehicleMake ? vehicleMake : '----'} {vehicleModel ? vehicleModel : '----'}
              </ThemedText>
              
              {!vehicle && (
                <TouchableOpacity 
                  style={styles.miniEditButton}
                  onPress={() => router.push(`/vehicles/new?workOrderId=${workOrderId}&customerId=${workOrder.customer_id}&prefill=true`)}
                >
                  <ThemedText style={styles.miniEditText}>Edit</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.vehicleDetailRow}>
              <ThemedText style={styles.detailLabel}>VIN:</ThemedText>
              <ThemedText style={!vehicleVin ? styles.missingValue : undefined}>
                {vehicleVin || 'Not available'}
              </ThemedText>
            </View>
            
            <View style={styles.vehicleDetailRow}>
              <ThemedText style={styles.detailLabel}>Mileage:</ThemedText>
              <ThemedText style={!vehicleMileage ? styles.missingValue : undefined}>
                {vehicleMileage ? (typeof vehicleMileage === 'number' ? vehicleMileage.toLocaleString() : vehicleMileage) : 'Not available'}
              </ThemedText>
            </View>
            
            {/* Info message if we have partial info but no vehicle record */}
            {!vehicle && Object.keys(vehicleInfo).length > 0 && (
              <ThemedText style={styles.infoMessage}>
                This vehicle information is stored temporarily. Click Edit to create a permanent vehicle record.
              </ThemedText>
            )}
          </TouchableOpacity>
        )}
      </ThemedView> 
        {/* Work Summary Section */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedText type="subtitle">Work Summary</ThemedText>
          
          <ThemedView 
            style={styles.summaryCard}
            lightColor="#f0f0f0"
            darkColor="#444444"
          >
            <ThemedText>{workOrder.work_summary || "No work summary available"}</ThemedText>
          </ThemedView>
        </ThemedView>
        
        {/* Line Items Section */}
        <ThemedView 
          style={styles.section}
          lightColor="#ffffff"
          darkColor="#333333"
        >
          <ThemedText type="subtitle">Line Items</ThemedText>
          
          {workOrder.line_items.length === 0 ? (
            <ThemedText style={styles.emptyText}>No line items recorded</ThemedText>
          ) : (
            <View>
              {workOrder.line_items.map((item: LineItem, index: number) => (
                <ThemedView 
                    key={index} 
                    style={styles.lineItemCard}
                    lightColor="#ffffff"
                    darkColor="#333333"
                  >
                  <ThemedView 
                      style={styles.lineItemHeader}
                      lightColor="#f0f0f0"
                      darkColor="#444444"
                    >
                    <ThemedText type="defaultSemiBold">{item.description}</ThemedText>
                    <ThemedText style={styles.itemType}>{item.type.toUpperCase()}</ThemedText>
                  </ThemedView>
                  
                  <ThemedView 
                      style={styles.lineItemDetails}
                      lightColor="#ffffff"
                      darkColor="#333333"
                    >
                    <ThemedText>Qty: {item.quantity}</ThemedText>
                    <ThemedText>Unit: ${item.unit_price.toFixed(2)}</ThemedText>
                    <ThemedText style={styles.lineItemTotal}>Total: ${item.total.toFixed(2)}</ThemedText>
                  </ThemedView>
                </ThemedView>
              ))}
              
              {/* Totals Section */}
              <ThemedView 
                  style={styles.totalsCard}
                  lightColor="#f0f0f0"
                  darkColor="#444444"
                >
                <ThemedView 
                    style={styles.totalRow}
                    lightColor="#ffffff"
                    darkColor="#333333"
                  >
                  <ThemedText>Parts Total:</ThemedText>
                  <ThemedText>${workOrder.total_parts.toFixed(2)}</ThemedText>
                </ThemedView>
                
                <ThemedView 
                    style={styles.totalRow}
                    lightColor="#ffffff"
                    darkColor="#333333"
                  >
                  <ThemedText>Labor Total:</ThemedText>
                  <ThemedText>${workOrder.total_labor.toFixed(2)}</ThemedText>
                </ThemedView>
                
                <ThemedView 
                    style={[styles.totalRow, styles.grandTotalRow]}
                    lightColor="#ffffff"
                    darkColor="#333333"
                  >
                  <ThemedText type="defaultSemiBold">GRAND TOTAL:</ThemedText>
                  <ThemedText type="defaultSemiBold">${workOrder.total.toFixed(2)}</ThemedText>
                </ThemedView>
              </ThemedView>
            </View>
          )}
        </ThemedView>
        
        {/* Action Buttons */}
        <ThemedView style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGenerateInvoice}
            disabled={generating !== null}
          >
            {generating === "invoice" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.actionButtonText}>Generate Invoice</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.estimateButton]}
            onPress={handleGenerateEstimate}
            disabled={generating !== null}
          >
            {generating === "estimate" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.actionButtonText}>Generate Estimate</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
        
        {/* Delete Button */}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={handleDeleteWorkOrder}
        >
          <ThemedText style={styles.deleteButtonText}>Delete Work Order</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      <PDFViewer
        visible={pdfModalVisible}
        onClose={() => setPdfModalVisible(false)}
        pdfUrl={currentPdfUrl}
        title={pdfTitle}
        baseApiUrl=""
      />
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
    case 'processing':
      return '#3498db';
    case 'processed':
      return '#4a90e2';
    case 'invoiced':
      return '#7ed321';
    case 'estimated':
      return '#50e3c2';
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
  },
  section: {
    marginBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  lineItemCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  lineItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemType: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  lineItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  lineItemTotal: {
    fontWeight: "600",
  },
  totalsCard: {
    padding: 16,
    borderRadius: 8,
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
  statusContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    overflow: "hidden",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 8,
  },
  estimateButton: {
    backgroundColor: "#4a90e2",
    marginRight: 0,
    marginLeft: 8,
  },
  actionButtonText: {
    color: "white",
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
  warningBanner: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f0ad4e',
  },
  warningTitle: {
    marginBottom: 4,
    color: '#8a6d3b',
  },
  warningText: {
    color: '#8a6d3b',
    marginBottom: 12,
  },
  notesContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  noteItem: {
    fontSize: 14,
    marginTop: 4,
    color: '#8a6d3b',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  addVehicleButton: {
    backgroundColor: '#5bc0de',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  warningActionButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyInfoCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0a7ea4',
    borderRadius: 4,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniEditButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  miniEditText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  detailLabel: {
    fontWeight: '600',
    width: 70,
  },
  missingValue: {
    color: '#999',
    fontStyle: 'italic',
  },
  infoMessage: {
    marginTop: 12,
    fontSize: 13,
    color: '#31708f',
    fontStyle: 'italic',
  },
  processingContainer: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#0a7ea4',
  },
  processingTitle: {
    marginTop: 8,
    marginBottom: 4,
    color: '#0a7ea4',
  },
  processingText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
});
