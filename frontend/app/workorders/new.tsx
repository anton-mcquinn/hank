import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  View,
  Platform,
  TextInput
} from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';

import ThemedText from "../components/ThemedText";
import ThemedView from "../components/ThemedView";
import api from "../api";
import { Customer } from "../api/types";

export default function NewWorkOrderScreen() {
  const params = useLocalSearchParams();
  const preselectedCustomerId = params.customerId as string | undefined;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [vinImage, setVinImage] = useState<any>(null);
  const [plateImage, setPlateImage] = useState<any>(null);
  const [odometerImage, setOdometerImage] = useState<any>(null);
  const [audioRecordings, setAudioRecordings] = useState<any[]>([]);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [transcript, setTranscript] = useState("");
  const [step, setStep] = useState(1); // 1 = Select Customer, 2 = Collect Data
  
    useFocusEffect(
      useCallback(() => {
        loadCustomers();
    return () => {
      // Cleanup function if needed
    };
  }, [])
);

    // Request audio recording permissions
    useEffect(() => {
      Audio.requestPermissionsAsync();
      
      // Request camera permissions
      ImagePicker.requestCameraPermissionsAsync();
      ImagePicker.requestMediaLibraryPermissionsAsync();

      return () => {
        // Clean up recording if component unmounts while recording
        if (recording) {
          stopRecording();
        }
        if (recordingTimer) {
          clearInterval(recordingTimer);
        }
      };
  }, []);

  useEffect(() => {
    // If a customer ID was passed in params, select that customer
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
        setStep(2); // Move to next step
      }
    }
  }, [preselectedCustomerId, customers]);

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const data = await api.customers.getAll();
      setCustomers(data);
    } catch (err: any) {
      Alert.alert("Error", "Failed to load customers");
      console.error("Error loading customers:", err);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStep(2); // Move to the next step
  };

  const handleCreateCustomer = () => {
    router.push("/customers/new?returnTo=workorders/new");
  };

  const pickImage = async (type: 'vin' | 'plate' | 'odometer') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        // Create a file object from the selected image URI
        const uri = result.assets[0].uri;
        const name = uri.split('/').pop() || 'image.jpg';
        const fileType = `image/${name.split('.').pop()}`;
        
        const file = {
          uri,
          name,
          type: fileType,
        };

        if (type === 'vin') {
          setVinImage(file);
        }
        if (type === 'plate') {
          setPlateImage(file);
        } 
        if (type === 'odometer') {
          setOdometerImage(file);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async (type: 'vin' | 'plate' | 'odometer') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        // Create a file object from the captured image URI
        const uri = result.assets[0].uri;
        const name = uri.split('/').pop() || 'image.jpg';
        const fileType = `image/${name.split('.').pop()}`;
        
        const file = {
          uri,
          name,
          type: fileType,
        };

        if (type === 'vin') {
          setVinImage(file);
        }
        if (type === 'plate') {
          setPlateImage(file);
        } else {
          setOdometerImage(file);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const startRecording = async () => {
    try {
      // Set up the recording options
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start a timer to track duration
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      // Stop the recording
      await recording.stopAndUnloadAsync();
      
      // Stop the timer
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      
      // Get the recording URI
      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }
      
      // Create a file object from the recording URI
      const name = `recording_${Date.now()}.m4a`;
      
      const file = {
        uri,
        name,
        type: 'audio/m4a',
      };
      
      // Add to recordings array
      setAudioRecordings(prev => [...prev, file]);
      
      // Reset recording state
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false) {
        const file = {
          uri: result.assets[0].uri,
          name: result.assets[0].name,
          type: result.assets[0].mimeType || 'audio/mpeg',
        };

        setAudioRecordings(prev => [...prev, file]);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
  };

  const handleRemoveAudio = (index: number) => {
    setAudioRecordings(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImage = (type: 'vin' | 'odometer') => {
    if (type === 'vin') {
      setVinImage(null);
    } else {
      setOdometerImage(null);
    }
  };

  const handleCreateWorkOrder = async () => {
    if (!selectedCustomer) {
      Alert.alert("Error", "Please select a customer");
      return;
    }

    setLoading(true);

    try {
      // Prepare form data for the API
      const formData: any = {
        customer_id: selectedCustomer.id,
        audio_files: audioRecordings,
        vin_image: vinImage,
        plate_image: plateImage,
        odometer_image: odometerImage,
        transcript,
      };

      // Call the API to create the work order
      const result = await api.workorders.create(formData);

      // Show success message and navigate to the work order
      Alert.alert(
        "Success",
        "Work order created successfully. Processing media files...",
        [
          { 
            text: "View Work Order", 
            onPress: () => router.replace(`/workorders/${result.order_id}`) 
          }
        ]
      );
    } catch (error: any) {
      console.error("Error creating work order:", error);
      Alert.alert("Error", error.message || "Failed to create work order");
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerSelection = () => {
    if (customersLoading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>Loading customers...</ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Select a Customer
        </ThemedText>

        <ScrollView style={styles.customerList}>
          {customers.length === 0 ? (
            <ThemedText style={styles.emptyText}>No customers found</ThemedText>
          ) : (
            customers.map(customer => (
              <TouchableOpacity
                key={customer.id}
                style={styles.customerCard}
                lightColor="#ffffff"
                darkColor="#333333"
                onPress={() => handleSelectCustomer(customer)}
              >
                <ThemedText type="defaultSemiBold">
                  {customer.first_name} {customer.last_name}
                </ThemedText>
                <ThemedText>{customer.phone}</ThemedText>
                <ThemedText>{customer.email}</ThemedText>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.createCustomerButton}
          onPress={handleCreateCustomer}
        >
          <ThemedText style={styles.buttonText}>+ Create New Customer</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  };

  const renderDataCollection = () => {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Selected Customer */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Customer</ThemedText>
          <TouchableOpacity 
            style={styles.selectedCustomerCard}
            lightColor="#ffffff"
            darkColor="#333333"
            onPress={() => setStep(1)} // Go back to customer selection
          >
            <ThemedText type="defaultSemiBold">
              {selectedCustomer?.first_name} {selectedCustomer?.last_name}
            </ThemedText>
            <ThemedText>{selectedCustomer?.phone}</ThemedText>
            <MaterialIcons name="edit" size={20} color="#0a7ea4" />
          </TouchableOpacity>
        </ThemedView>
        
        {/* VIN Image */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Vehicle VIN</ThemedText>
          <ThemedText style={styles.instruction}>
            Take a photo of the VIN placard (usually on driver's door frame)
          </ThemedText>
          
          {vinImage ? (
            <ThemedView style={styles.imagePreviewContainer}>
              <ThemedView style={styles.imagePlaceholder}>
                <ThemedText style={styles.previewText}>VIN Image Selected</ThemedText>
                <FontAwesome5 name="check-circle" size={24} color="green" />
              </ThemedView>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => handleRemoveImage('vin')}
              >
                <MaterialIcons name="delete" size={20} color="red" />
                <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.imageButtonsContainer}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={() => takePhoto('vin')}
              >
                <FontAwesome5 name="camera" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Take Photo</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageButton, styles.uploadButton]}
                onPress={() => pickImage('vin')}
              >
                <FontAwesome5 name="image" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Upload Image</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>

        {/* Plate Image */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Vehicle License Plate</ThemedText>
          <ThemedText style={styles.instruction}>
            Take a phonto of the vehicle's license plate
          </ThemedText>
          
          {plateImage ? (
            <ThemedView style={styles.imagePreviewContainer}>
              <ThemedView style={styles.imagePlaceholder}>
                <ThemedText style={styles.previewText}>License plage image selected</ThemedText>
                <FontAwesome5 name="check-circle" size={24} color="green" />
              </ThemedView>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => handleRemoveImage('plate')}
              >
                <MaterialIcons name="delete" size={20} color="red" />
                <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.imageButtonsContainer}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={() => takePhoto('plate')}
              >
                <FontAwesome5 name="camera" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Take Photo</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageButton, styles.uploadButton]}
                onPress={() => pickImage('plate')}
              >
                <FontAwesome5 name="image" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Upload Image</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>
        
        {/* Odometer Image */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Odometer Reading</ThemedText>
          <ThemedText style={styles.instruction}>
            Take a photo of the current odometer reading
          </ThemedText>
          
          {odometerImage ? (
            <ThemedView style={styles.imagePreviewContainer}>
              <ThemedView style={styles.imagePlaceholder}>
                <ThemedText style={styles.previewText}>Odometer Image Selected</ThemedText>
                <FontAwesome5 name="check-circle" size={24} color="green" />
              </ThemedView>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => handleRemoveImage('odometer')}
              >
                <MaterialIcons name="delete" size={20} color="red" />
                <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ) : (
            <ThemedView style={styles.imageButtonsContainer}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={() => takePhoto('odometer')}
              >
                <FontAwesome5 name="camera" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Take Photo</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.imageButton, styles.uploadButton]}
                onPress={() => pickImage('odometer')}
              >
                <FontAwesome5 name="image" size={20} color="#fff" />
                <ThemedText style={styles.imageButtonText}>Upload Image</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>
        
        {/* Audio Recordings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Work Description</ThemedText>
          <ThemedText style={styles.instruction}>
            Record a voice memo describing the work to be done
          </ThemedText>
          
          {/* Recording UI */}
          <ThemedView style={styles.recordingContainer}>
            {isRecording ? (
              <ThemedView style={styles.activeRecordingContainer}>
                <ThemedView style={styles.recordingInfo}>
                  <ThemedView style={styles.recordingIndicator} />
                  <ThemedText style={styles.recordingText}>Recording... {formatTime(recordingDuration)}</ThemedText>
                </ThemedView>
                
                <TouchableOpacity 
                  style={styles.stopButton}
                  onPress={stopRecording}
                >
                  <FontAwesome5 name="stop" size={20} color="#fff" />
                  <ThemedText style={styles.buttonText}>Stop</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ) : (
              <TouchableOpacity 
                style={styles.recordButton}
                onPress={startRecording}
              >
                <FontAwesome5 name="microphone" size={20} color="#fff" />
                <ThemedText style={styles.buttonText}>Record Audio</ThemedText>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.uploadAudioButton}
              onPress={pickAudioFile}
            >
              <FontAwesome5 name="file-audio" size={20} color="#fff" />
              <ThemedText style={styles.buttonText}>Upload Audio File</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          {/* Recordings List */}
          {audioRecordings.length > 0 && (
            <ThemedView style={styles.recordingsList}
              lightColor="#ffffff"
              darkColor="#333333"
            >
              <ThemedText type="defaultSemiBold" style={styles.recordingsTitle}>
                Recordings ({audioRecordings.length})
              </ThemedText>

              {audioRecordings.map((recording, index) => (
                <ThemedView key={index} style={styles.recordingItem}>
                  <ThemedView style={styles.recordingDetails}>
                    <FontAwesome5 name="file-audio" size={16} color="#666" />
                    <ThemedText style={styles.recordingName}>
                      Recording {index + 1}
                    </ThemedText>
                  </ThemedView>

                  <TouchableOpacity
                    onPress={() => handleRemoveAudio(index)}
                  >
                    <MaterialIcons name="delete" size={20} color="red" />
                  </TouchableOpacity>
                </ThemedView>
              ))}
            </ThemedView>
          )}

          <ThemedText style={[styles.instruction, { marginTop: 16 }]}>
            Or type the work description instead
          </ThemedText>
          <TextInput
            style={styles.transcriptInput}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Describe what was done — replaces or augments any audio."
            placeholderTextColor="#888"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </ThemedView>
        
        {/* Create Button */}
        <TouchableOpacity 
          style={[
            styles.createButton, 
            loading && styles.disabledButton
          ]}
          onPress={handleCreateWorkOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.createButtonText}>
              Create Work Order
            </ThemedText>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ 
        title: "New Work Order",
        headerBackTitle: "Back",
        headerBackButtonDisplay: "minimal",
      }} />
      
      {step === 1 ? renderCustomerSelection() : renderDataCollection()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  customerList: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  customerCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedCustomerCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 20,
  },
  createCustomerButton: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    margin: 16,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  transcriptInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    backgroundColor: "#fff",
    color: "#000",
    fontSize: 15,
  },
  instruction: {
    color: "#666",
    marginVertical: 8,
  },
  imageButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  imageButton: {
    backgroundColor: "#0a7ea4",
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginRight: 8,
  },
  uploadButton: {
    backgroundColor: "#4a90e2",
    marginRight: 0,
    marginLeft: 8,
  },
  imageButtonText: {
    color: "white",
    marginLeft: 8,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    marginTop: 8,
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  previewText: {
    marginBottom: 8,
    color: "#333",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  removeButtonText: {
    color: "red",
    marginLeft: 4,
  },
  recordingContainer: {
    marginTop: 16,
  },
  recordButton: {
    backgroundColor: "#e74c3c",
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  uploadAudioButton: {
    backgroundColor: "#4a90e2",
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  activeRecordingContainer: {
    marginBottom: 12,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e74c3c",
    marginRight: 8,
  },
  recordingText: {
    color: "#333",
  },
  stopButton: {
    backgroundColor: "#e74c3c",
    padding: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingsList: {
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
  },
  recordingsTitle: {
    marginBottom: 12,
  },
  recordingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  recordingDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingName: {
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: "#27ae60",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.7,
  },
  createButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 16,
  },
});
