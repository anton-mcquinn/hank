import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';

import ThemedText from './ThemedText';
import ThemedView from './ThemedView';

interface PDFViewerProps {
  visible: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
  baseApiUrl: string;
}

export default function PDFViewer({ 
  visible, 
  onClose, 
  pdfUrl, 
  title = 'Document',
  baseApiUrl
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setTokenReady(false);
      return;
    }
    SecureStore.getItemAsync('userToken')
      .then((token) => {
        setAuthToken(token);
        setTokenReady(true);
      })
      .catch((err) => {
        console.error('Error loading auth token for PDFViewer:', err);
        setAuthToken(null);
        setTokenReady(true);
      });
  }, [visible]);
  
  // Add a force timeout to hide the spinner after a set time
  useEffect(() => {
    if (visible && loading) {
      // Force hide the loading spinner after 8 seconds regardless
      const timeout = setTimeout(() => {
        console.log('Forcing loading spinner to hide after timeout');
        setLoading(false);
      }, 8000);
      
      return () => clearTimeout(timeout);
    }
  }, [visible, loading]);

  // Reset loading state when the modal becomes visible
  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
    }
  }, [visible]);

  // Function to download the PDF
  const downloadPDF = async () => {
    if (!pdfUrl) return;
    
    setDownloading(true);
    setError(null);
    
    try {
      const fullUrl = getSourceUrl();
      const filename = pdfUrl.split('/').pop()?.split('?')[0] || 'invoice.pdf';

      if (Platform.OS === 'web') {
        window.open(fullUrl, '_blank');
        setDownloading(false);
        return;
      }

      const downloadDirectory = FileSystem.documentDirectory + 'downloads/';
      const dirInfo = await FileSystem.getInfoAsync(downloadDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDirectory, { intermediates: true });
      }

      const downloadPath = downloadDirectory + filename;
      console.log('Downloading to:', downloadPath);

      // Presigned R2 URLs are self-authenticating via query params; sending an Authorization
      // header would be redundant (and breaks signature validation on some S3-compatible stores).
      const downloadOptions = isPresigned(fullUrl) || !authToken
        ? undefined
        : { headers: { Authorization: `Bearer ${authToken}` } };
      const downloadResult = await FileSystem.downloadAsync(
        fullUrl,
        downloadPath,
        downloadOptions
      );
      console.log('Download result:', downloadResult);

      if (downloadResult.status === 200) {
        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save or share PDF',
            UTI: 'com.adobe.pdf' // iOS only
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      } else {
        setError('Failed to download the PDF');
      }
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Error downloading the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // S3/R2 presigned URLs always carry an X-Amz-Signature query param.
  const isPresigned = (url: string) => url.includes('X-Amz-Signature=');

  // Properly fixed getSourceUrl function with detailed logging
  const getSourceUrl = () => {
    if (!pdfUrl) {
      console.log('No PDF URL provided');
      return '';
    }
    
    // If it's already a full URL, use it
    if (pdfUrl.startsWith('http')) {
      console.log('Using full URL:', pdfUrl);
      return pdfUrl;
    }
    
    // Make sure baseApiUrl doesn't end with a slash
    const apiUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl;
    
    // Make sure pdfUrl starts with a slash
    const apiPath = pdfUrl.startsWith('/') ? pdfUrl : `/${pdfUrl}`;
    
    const fullUrl = `${apiUrl}${apiPath}`;
    console.log("Full PDF Viewer URL:", fullUrl);
    
    return fullUrl;
  };

  // This JavaScript will inject a button to manually hide the spinner
  // This is a fallback if automatic loading detection fails
  const injectedJavaScript = `
    // Create a floating action button to hide the spinner
    const createHideLoadingButton = () => {
      const btn = document.createElement('button');
      btn.textContent = 'PDF Loaded';
      btn.style.position = 'fixed';
      btn.style.bottom = '20px';
      btn.style.right = '20px';
      btn.style.padding = '10px';
      btn.style.backgroundColor = '#0a7ea4';
      btn.style.color = 'white';
      btn.style.borderRadius = '5px';
      btn.style.border = 'none';
      btn.style.zIndex = '9999';
      btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      btn.onclick = () => {
        window.ReactNativeWebView.postMessage('MANUALLY_LOADED');
        btn.style.display = 'none';
      };
      document.body.appendChild(btn);
    };
    
    // Wait a moment to make sure the DOM is ready
    setTimeout(() => {
      createHideLoadingButton();
      window.ReactNativeWebView.postMessage('LOADED_HELPER_ADDED');
    }, 2000);
    
    // Also notify when document is fully loaded
    document.addEventListener('DOMContentLoaded', () => {
      window.ReactNativeWebView.postMessage('DOM_LOADED');
    });
    
    window.addEventListener('load', () => {
      window.ReactNativeWebView.postMessage('WINDOW_LOADED');
      
      // Check for common PDF elements
      const hasPdfElements = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe, canvas');
      if (hasPdfElements) {
        window.ReactNativeWebView.postMessage('PDF_ELEMENTS_FOUND');
      }
    });
    
    true;
  `;

  // Track loading progress
  const handleLoadProgress = ({ nativeEvent }) => {
    const { progress } = nativeEvent;
    console.log(`WebView loading progress: ${progress * 100}%`);
    
    // When progress reaches 100%, we can be pretty confident the PDF is loaded
    if (progress >= 1) {
      // Add a small delay to make sure rendering is complete
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  // Handle messages from the WebView
  const handleMessage = (event) => {
    const message = event.nativeEvent.data;
    console.log('Received message from WebView:', message);
    
    // Various events that might indicate the PDF is loaded
    if (
      message === 'DOM_LOADED' || 
      message === 'WINDOW_LOADED' || 
      message === 'PDF_ELEMENTS_FOUND' ||
      message === 'MANUALLY_LOADED'
    ) {
      console.log('Hiding spinner based on WebView message');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.header}>
          <View style={styles.titleContainer}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#0a7ea4" />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={styles.title}>
              {title}
            </ThemedText>
          </View>
          
          <TouchableOpacity 
            style={styles.downloadButton}
            onPress={downloadPDF}
            disabled={downloading || !pdfUrl}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <FontAwesome name="download" size={16} color="white" />
                <ThemedText style={styles.downloadText}>Download</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </ThemedView>

        {error ? (
          <ThemedView style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={48} color="red" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <ThemedText style={styles.retryText}>Retry</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0a7ea4" />
                <ThemedText style={styles.loadingText}>Loading PDF...</ThemedText>
                
                {/* Manual hide button if all else fails */}
                <TouchableOpacity
                  style={styles.manualHideButton}
                  onPress={() => setLoading(false)}
                >
                  <ThemedText style={styles.manualHideText}>
                    PDF Loaded? Tap Here
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
            
            {tokenReady && (
            <WebView
              ref={webViewRef}
              source={{
                uri: getSourceUrl(),
                headers:
                  authToken && !isPresigned(getSourceUrl())
                    ? { Authorization: `Bearer ${authToken}` }
                    : undefined,
              }}
              style={styles.webView}
              onLoadEnd={() => {
                console.log('WebView onLoadEnd fired');
                // Add a small delay to ensure rendering is complete
                setTimeout(() => {
                  setLoading(false);
                }, 1000);
              }}
              onLoadStart={() => console.log('WebView onLoadStart fired')}
              onLoad={() => {
                console.log('WebView onLoad fired - PDF should be loaded');
                // This should fire when the PDF is loaded, but sometimes doesn't work
                setTimeout(() => {
                  setLoading(false);
                }, 1000);
              }}
              onLoadProgress={handleLoadProgress}
              onMessage={handleMessage}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
                setLoading(false);
                setError(`Error loading PDF: ${nativeEvent.description || 'Unknown error'}`);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView HTTP error:', nativeEvent);
                setLoading(false);
                setError(`HTTP error ${nativeEvent.statusCode}: ${nativeEvent.description || 'Unknown error'}`);
              }}
              injectedJavaScript={injectedJavaScript}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={Platform.OS === 'android'}
              useWebKit={true}
            />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    marginLeft: 8,
  },
  downloadButton: {
    backgroundColor: '#0a7ea4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  downloadText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    color: '#0a7ea4',
  },
  manualHideButton: {
    marginTop: 24,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  manualHideText: {
    color: '#0a7ea4',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    color: 'red',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
});
