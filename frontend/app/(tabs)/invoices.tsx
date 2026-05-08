import React, { useEffect, useState, useCallback } from "react";
import { 
  StyleSheet, 
  View, 
  ActivityIndicator, 
  TouchableOpacity, 
  TextInput,
  FlatList,
  RefreshControl,
  Platform,
  SafeAreaView,
  Alert
} from "react-native";
import { router } from "expo-router";
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import PDFViewer from "../components/PDFViewer";
import api from "../api";
import { WorkOrder } from "../api/types";

// Filter types
type FilterType = 'invoice' | 'estimate' | 'all';

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<WorkOrder[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<WorkOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PDF viewer state
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Load work orders with invoice/estimate status
  useEffect(() => {
    loadInvoices();
  }, []);

  // Apply filters and search whenever dependencies change
  useEffect(() => {
    applyFiltersAndSearch();
  }, [invoices, filter, searchQuery]);

  const loadInvoices = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Get all work orders
      const workOrders = await api.workorders.getAll();
      
      // Filter for those with invoiced or estimated status
      const invoiceData = workOrders.filter(
        wo => wo.status === 'invoiced' || wo.status === 'estimated'
      );

      // Get unique customer IDs from the filtered invoices
      const customerIds = [...new Set(
        invoiceData
          .filter(wo => wo.customer_id)
          .map(wo => wo.customer_id as string)
      )];
      
      // Create a lookup map for customers
      const customerMap: Record<string, any> = {};
      
      // Fetch customer data for each invoice
      if (customerIds.length > 0) {
        // For each customer ID, fetch the customer data
        for (const customerId of customerIds) {
          try {
            const customer = await api.customers.getById(customerId);
            customerMap[customerId] = customer;
          } catch (err) {
            console.warn(`Failed to load customer ${customerId}:`, err);
          }
        }
      }
      
      // Enhance the invoice data with customer details
      const enhancedInvoices = invoiceData.map(invoice => {
        if (invoice.customer_id && customerMap[invoice.customer_id]) {
          return { ...invoice, customer: customerMap[invoice.customer_id] };
        }
        return invoice;
      });
      
      setInvoices(enhancedInvoices);
    } catch (err: any) {
      setError(err.message || "Failed to load invoices");
      console.error("Error loading invoices:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFiltersAndSearch = useCallback(() => {
    let result = [...invoices];
    
    // Apply status filter
    if (filter === 'invoice') {
      result = result.filter(item => item.status === 'invoiced');
    } else if (filter === 'estimate') {
      result = result.filter(item => item.status === 'estimated');
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        // Search in multiple fields
        const idMatch = item.id.toLowerCase().includes(query);
        const customerNameMatch = item.customer?.first_name?.toLowerCase().includes(query) || 
                                 item.customer?.last_name?.toLowerCase().includes(query);
        const vehicleMatch = item.vehicle?.make?.toLowerCase().includes(query) ||
                            item.vehicle?.model?.toLowerCase().includes(query);
        const summaryMatch = item.work_summary.toLowerCase().includes(query);
        
        return idMatch || customerNameMatch || vehicleMatch || summaryMatch;
      });
    }
    
    setFilteredInvoices(result);
  }, [invoices, filter, searchQuery]);

  const handleRefresh = () => {
    loadInvoices(true);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Generate and preview PDF
  const handleViewPdf = async (workOrder: WorkOrder) => {
    try {
      setGeneratingPdf(true);
      const isEstimate = workOrder.status === 'estimated';
      
      // Determine if this is an invoice or estimate and set the title appropriately
      const documentType = isEstimate ? 'Estimate' : 'Invoice';
      const documentId = workOrder.id.slice(0, 8);
      const title = `${documentType} #${documentId}`;
      
      // Set the PDF title even before we have the URL
      setPdfTitle(title);
      
      // API endpoint differs based on document type
      const endpoint = isEstimate ? 'generate-estimate' : 'generate-invoice';
      
      // Make API call to generate PDF
      let response;
      if (isEstimate) {
        response = await api.invoices.generateEstimate(workOrder.id, {
          generate_pdf: true,
          send_email: false
        });
      } else {
        response = await api.invoices.generateInvoice(workOrder.id, {
          generate_pdf: true,
          send_email: false
        });
      }
      
      // Check if PDF was generated successfully
      if (response.pdf_path) {
        let filename = response.pdf_path.split('/').pop();
        console.log(filename);
        const pdfUrl = `/api/v1/invoices/${filename}`;
        console.log(pdfUrl);
        setCurrentPdfUrl(pdfUrl);
        setPdfModalVisible(true);
      } else {
        throw new Error('PDF generation failed. No PDF path returned.');
      }
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to generate PDF. Please try again.'
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Render a single invoice/estimate item
  const renderInvoiceItem = ({ item }: { item: WorkOrder }) => {
    // Format the date
    const date = new Date(item.updated_at);
    const formattedDate = date.toLocaleDateString();
    
    // Get customer name or placeholder
    const customerName = item.customer 
      ? `${item.customer.first_name} ${item.customer.last_name}`
      : item.customer_id
        ? `Customer ID: ${item.customer_id.slice(0, 8)}`
        : "No customer";
      
    // Get vehicle info or placeholder
    const vehicleInfo = item.vehicle
      ? `${item.vehicle.year || ''} ${item.vehicle.make || ''} ${item.vehicle.model || ''}`.trim()
      : item.vehicle_info && Object.keys(item.vehicle_info).length > 0
        ? `${item.vehicle_info.year || ''} ${item.vehicle_info.make || ''} ${item.vehicle_info.model || ''}`.trim()
        : "No vehicle info";
    
    return (
      <ThemedView
        style={styles.invoiceCard}
        lightColor="#ffffff"
        darkColor="#333333"
        >
      <TouchableOpacity 
        onPress={() => router.push(`/workorders/${item.id}`)}
      >
        <View style={styles.invoiceHeader}>
          <ThemedText type="defaultSemiBold">
            {item.status === 'invoiced' ? 'Invoice' : 'Estimate'} #{item.id.slice(0, 8)}
          </ThemedText>
          <ThemedText style={styles.dateText}>{formattedDate}</ThemedText>
        </View>
        
        <View style={styles.invoiceDetails}>
          <View style={styles.detailRow}>
            <FontAwesome5 name="user" size={14} color="#687076" style={styles.icon} />
            <ThemedText>{customerName}</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <FontAwesome5 name="car" size={14} color="#687076" style={styles.icon} />
            <ThemedText>{vehicleInfo}</ThemedText>
          </View>
        </View>
        
        <View style={styles.invoiceFooter}>
          <View style={styles.statusRow}>
            <ThemedText 
              style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'invoiced' ? '#7ed321' : '#50e3c2' }
              ]}
            >
              {item.status === 'invoiced' ? 'INVOICE' : 'ESTIMATE'}
            </ThemedText>
            <ThemedText style={styles.priceText}>${item.total.toFixed(2)}</ThemedText>
          </View>
          
          <TouchableOpacity 
            style={styles.viewPdfButton}
            onPress={() => handleViewPdf(item)}
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialIcons name="picture-as-pdf" size={16} color="#ffffff" />
                <ThemedText style={styles.viewPdfText}>View PDF</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      </ThemedView>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading invoices...</ThemedText>
      </ThemedView>
    );
  }

  // Render error state
  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadInvoices()}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}
            lightColor="#f5f5f5"
            darkColor="#333333"
            >
            <Ionicons name="search" size={20} color="#687076" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoices..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={20} color="#687076" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[
              styles.filterTab, 
              filter === 'all' && styles.activeFilterTab
            ]}
            onPress={() => handleFilterChange('all')}
          >
            <ThemedText 
              style={[
                styles.filterText,
                filter === 'all' && styles.activeFilterText
              ]}
            >
              All
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterTab, 
              filter === 'invoice' && styles.activeFilterTab
            ]}
            onPress={() => handleFilterChange('invoice')}
          >
            <ThemedText 
              style={[
                styles.filterText,
                filter === 'invoice' && styles.activeFilterText
              ]}
            >
              Invoices
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterTab, 
              filter === 'estimate' && styles.activeFilterTab
            ]}
            onPress={() => handleFilterChange('estimate')}
          >
            <ThemedText 
              style={[
                styles.filterText,
                filter === 'estimate' && styles.activeFilterText
              ]}
            >
              Estimates
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <ThemedView style={styles.emptyContainer}>
            <FontAwesome5 name="file-invoice-dollar" size={48} color="#ccc" />
            <ThemedText style={styles.emptyText}>
              {searchQuery 
                ? "No matching invoices found" 
                : filter !== 'all'
                  ? `No ${filter}s found`
                  : "No invoices or estimates found"}
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Generate invoices or estimates from work orders
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={filteredInvoices}
            renderItem={renderInvoiceItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#0a7ea4"]}
                tintColor="#0a7ea4"
              />
            }
          />
        )}
        
        {/* PDF Viewer Modal */}
        <PDFViewer
          visible={pdfModalVisible}
          onClose={() => setPdfModalVisible(false)}
          pdfUrl={currentPdfUrl}
          title={pdfTitle}
          baseApiUrl="https://hank.idleworkshop.com"
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 16,
  },
  activeFilterTab: {
    backgroundColor: '#0a7ea4',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  invoiceCard: {
    padding: 16,
    borderRadius: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#687076',
  },
  invoiceDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  icon: {
    marginRight: 8,
    width: 18, // Fixed width for alignment
  },
  invoiceFooter: {
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    overflow: 'hidden',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewPdfButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  viewPdfText: {
    color: 'white',
    fontWeight: '500',
    marginLeft: 6,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#687076',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 4,
  },
  retryText: {
    color: 'white',
  },
});
