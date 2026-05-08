import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { FontAwesome5 } from '@expo/vector-icons';

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import api from "../api";
import { WorkOrder, Customer } from "../api/types";
import { useColorScheme } from "../hooks/useColorScheme";
import { Colors } from "../constants/Colors";
import { AuthContext } from "../context/AuthContext";

export default function Index() {
  const colorScheme = useColorScheme() ?? 'light';
  const { userToken } = useContext(AuthContext);
  const navigation = useNavigation();
  const [workorders, setWorkorders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingWorkOrders: 0,
    completedWorkOrders: 0,
    invoicedAmount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  
  // Get current date for display
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    if (shopName) {
      navigation.setOptions({ headerTitle: shopName });
    }
  }, [shopName]);

  // Load data when component mounts (only when authenticated)
  useFocusEffect(
    useCallback(() => {
      if (userToken) {
        loadDashboardData();
      }
    }, [userToken])
  );

  // Function to load all dashboard data
  const loadDashboardData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Load shop settings for header title
      const shopData = await api.shop.getSettings();
      if (shopData?.name) {
        setShopName(shopData.name);
      }

      // Load work orders
      const workOrderData = await api.workorders.getAll();
      setWorkorders(workOrderData);

      // Load customers
      const customerData = await api.customers.getAll();
      setCustomers(customerData);
      
      // Calculate stats
      const pendingOrders = workOrderData.filter(wo => 
        wo.status === 'pending' || wo.status === 'processed'
      ).length;
      
      const completedOrders = workOrderData.filter(wo => 
        wo.status === 'invoiced' || wo.status === 'estimated'
      ).length;
      
      const invoicedTotal = workOrderData
        .filter(wo => wo.status === 'invoiced')
        .reduce((sum, wo) => sum + wo.total, 0);
      
      setStats({
        totalCustomers: customerData.length,
        pendingWorkOrders: pendingOrders,
        completedWorkOrders: completedOrders,
        invoicedAmount: invoicedTotal,
      });
    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  // Get recent work orders (last 5)
  const recentWorkOrders = workorders
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  // Helper function for status colors
  const getStatusColor = (status: string): string => {
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
      case 'error':
        return '#d0021b';
      default:
        return '#aaaaaa';
    }
  };

  // Render loading state
  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <ThemedText style={styles.loadingText}>Loading dashboard...</ThemedText>
      </ThemedView>
    );
  }

  // Render error state
  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity 
          style={[styles.retryButton, {backgroundColor: Colors[colorScheme].tint}]} 
          onPress={() => loadDashboardData()}
        >
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors[colorScheme].tint]}
            tintColor={Colors[colorScheme].tint}
          />
        }
      >
        {/* Header Section */}
        <ThemedView style={styles.header}>
          <ThemedView style={styles.greetingContainer}>
            <ThemedText type="title">Welcome Back!</ThemedText>
          </ThemedView>
          <ThemedText style={styles.dateText}>{formattedDate}</ThemedText>
        </ThemedView>
        
        {/* Stats Section */}
        <ThemedView style={styles.statsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Shop Overview</ThemedText>
          
          <View style={styles.statsGrid}>
            {/* Customers Stat */}
            <ThemedView 
              style={styles.statCard}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <FontAwesome5 
                name="users" 
                size={24} 
                color={colorScheme === 'light' ? "#0a7ea4" : "#4a90e2"} 
                style={styles.statIcon} 
              />
              <ThemedText style={styles.statValue}>{stats.totalCustomers}</ThemedText>
              <ThemedText style={styles.statLabel}>Customers</ThemedText>
            </ThemedView>
            
            {/* Pending Work Orders Stat */}
            <ThemedView 
              style={styles.statCard}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <FontAwesome5 
                name="tools" 
                size={24} 
                color={colorScheme === 'light' ? "#f5a623" : "#f5a623"} 
                style={styles.statIcon} 
              />
              <ThemedText style={styles.statValue}>{stats.pendingWorkOrders}</ThemedText>
              <ThemedText style={styles.statLabel}>Pending Jobs</ThemedText>
            </ThemedView>
            
            {/* Completed Work Orders Stat */}
            <ThemedView 
              style={styles.statCard}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <FontAwesome5 
                name="check-circle" 
                size={24} 
                color={colorScheme === 'light' ? "#7ed321" : "#7ed321"} 
                style={styles.statIcon} 
              />
              <ThemedText style={styles.statValue}>{stats.completedWorkOrders}</ThemedText>
              <ThemedText style={styles.statLabel}>Completed</ThemedText>
            </ThemedView>
            
            {/* Revenue Stat */}
            <ThemedView 
              style={styles.statCard}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <FontAwesome5 
                name="dollar-sign" 
                size={24} 
                color={colorScheme === 'light' ? "#4a90e2" : "#4a90e2"} 
                style={styles.statIcon} 
              />
              <ThemedText style={styles.statValue}>${stats.invoicedAmount.toFixed(2)}</ThemedText>
              <ThemedText style={styles.statLabel}>Invoiced</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>
        
        {/* Quick Actions Section */}
        <ThemedView style={styles.quickActionsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Quick Actions</ThemedText>
          
          <View style={styles.actionsGrid}>
            {/* New Work Order Button */}
            <TouchableOpacity 
              style={[styles.actionButton, {backgroundColor: '#4190e2'}]}
              onPress={() => router.push('/workorders/new')}
            >
              <FontAwesome5 name="clipboard-list" size={24} color="#fff" style={styles.actionIcon} />
              <ThemedText style={styles.actionText}>New Work Order</ThemedText>
            </TouchableOpacity>
            
            {/* New Customer Button */}
            <TouchableOpacity 
              style={[styles.actionButton, styles.customerButton, {backgroundColor: '#4a90e2'}]}
              onPress={() => router.push('/customers/new')}
            >
              <FontAwesome5 name="user-plus" size={24} color="#fff" style={styles.actionIcon} />
              <ThemedText style={styles.actionText}>Add Customer</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
        
        {/* Recent Work Orders Section */}
        <ThemedView style={styles.recentWorkOrdersContainer}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Recent Work Orders</ThemedText>
            <TouchableOpacity onPress={() => router.push('/workorders')}>
              <ThemedText 
                style={[styles.viewAllText, {color: Colors[colorScheme].tint}]}
              >
                View All
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          {recentWorkOrders.length === 0 ? (
            <ThemedView 
              style={styles.emptyStateContainer}
              lightColor="#f5f5f5"
              darkColor="#2a2a2a"
            >
              <FontAwesome5 
                name="clipboard" 
                size={24} 
                color={colorScheme === 'light' ? "#999" : "#666"} 
              />
              <ThemedText style={styles.emptyStateText}>No work orders yet</ThemedText>
            </ThemedView>
          ) : (
            recentWorkOrders.map((workOrder) => (
              <TouchableOpacity 
                key={workOrder.id}
                onPress={() => router.push(`/workorders/${workOrder.id}`)}
              >
                <ThemedView 
                  style={styles.workOrderCard}
                  lightColor="#ffffff"
                  darkColor="#333333"
                >
                  <View style={styles.workOrderHeader}>
                    <ThemedText type="defaultSemiBold">Order #{workOrder.id.slice(0, 8)}</ThemedText>
                    <ThemedText style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(workOrder.status) }
                    ]}>
                      {workOrder.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  
                  <ThemedText numberOfLines={2} style={styles.workOrderSummary}>
                    {workOrder.work_summary || "No work summary available"}
                  </ThemedText>
                  
                  <View style={styles.workOrderFooter}>
                    <ThemedText style={styles.dateDisplay}>
                      {new Date(workOrder.updated_at).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText style={styles.priceDisplay}>
                      ${workOrder.total.toFixed(2)}
                    </ThemedText>
                  </View>
                </ThemedView>
              </TouchableOpacity>
            ))
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 16,
    opacity: 0.7,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    opacity: 0.7,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    borderRadius: 8,
    padding: 16,
    width: '48%',
    alignItems: 'center',
  },
  customerButton: {
    // Style defined inline with explicit color
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
  },
  recentWorkOrdersContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontWeight: '600',
  },
  workOrderCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  workOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  workOrderSummary: {
    marginBottom: 12,
  },
  workOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateDisplay: {
    opacity: 0.7,
    fontSize: 14,
  },
  priceDisplay: {
    fontWeight: '600',
    fontSize: 16,
  },
  emptyStateContainer: {
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    marginTop: 8,
    opacity: 0.6,
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
    borderRadius: 4,
  },
  retryText: {
    color: "white",
  },
});
