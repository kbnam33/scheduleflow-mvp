// app/screens/chat.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import axios from 'axios'; // Ensure axios is imported

type Message = { id: string; text: string; sender: 'user' | 'assistant'; timestamp: string };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const STUB_QUICK_ACTIONS = [
  { id: '1', title: 'Reschedule', subtitle: 'I cannot attend a meeting' },
  { id: '2', title: 'Update a document', subtitle: 'Summarize meeting notes' },
  { id: '3', title: 'Create a plan', subtitle: 'Complete pending tasks' },
  { id: '4', title: 'Notify Team', subtitle: 'Upcoming meeting' },
];

// IMPORTANT: Ensure this IP address is correct for your local development machine
// and that your emulator/device can reach it on your network.
// Example: const API_BASE_URL = 'http://192.168.1.10:3001/api';
// CORRECTED THE TYPO HERE:
const API_BASE_URL = 'http://192.168.1.5:3001/api'; 

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [hasUnreadSuggestions, setHasUnreadSuggestions] = useState(true); // From your existing code

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleQuickActionPress = (actionSubtitle: string) => {
    setInput(actionSubtitle);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    setTyping(true);
    setShowQuickActions(false);

    try {
      const response = await axios.post(`${API_BASE_URL}/ai/chat`,
        { message: currentInput },
        { headers: { 'Authorization': `Bearer test-token` } }
      );

      const aiResponseData = response.data;

      if (aiResponseData && aiResponseData.message) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: aiResponseData.message,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error("Invalid AI response format");
      }

    } catch (error) {
      // Enhanced error logging as requested
      console.error("Full Axios error object:", JSON.stringify(error, null, 2));
      if (axios.isAxiosError(error)) {
        console.error("Axios error details:", {
          message: error.message,
          code: error.code,
          config: error.config ? { method: error.config.method, url: error.config.url, headers: error.config.headers, data: error.config.data } : 'No config', // Simplified config
          request: error.request ? 'Request object exists' : 'No request object',
          response: error.response ? { status: error.response.status, data: error.response.data } : 'No response object',
        });
      }
      // ---

      const errorText = error.message || "An unexpected error occurred."; // Fallback error message
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: `I'm sorry, I couldn't process your request right now. (${errorText === "Network Error" ? "Network Error" : "Please try again later."})`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);

      if (errorText === "Network Error") {
        Alert.alert(
          "Connection Error", 
          "Could not connect to the server. Please ensure:\n1. The server is running.\n2. The API URL in the app is correct (especially the IP address for emulators/devices).\n3. Your device/emulator is on the same network as the server.\n4. For Android, cleartext traffic might be blocked if not configured (see network_security_config.xml)."
        );
      }
    } finally {
      setLoading(false);
      setTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!typing) return null;
    return (
      <View style={styles.typingIndicatorContainer}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.typingText}>AI is thinking...</Text>
      </View>
    );
  };

  const renderQuickActions = () => {
    if (!showQuickActions) return null;
    return (
      <View style={styles.quickActionsContainer}>
        {STUB_QUICK_ACTIONS.map(action => (
          <TouchableOpacity key={action.id} style={styles.quickActionBubble} onPress={() => handleQuickActionPress(action.subtitle)}>
            <Text style={styles.quickActionTitle}>{action.title}</Text>
            <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top -12, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + insets.bottom + 56) : 0} 
      >
        <View style={styles.headerRow}>
          <View style={styles.headerRowTopLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#a3b3c2b3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chat</Text>
          </View>
          <TouchableOpacity>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#a3b3c299" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderTypingIndicator}
        />

        {renderQuickActions()}

        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.micIcon}>
            <MaterialCommunityIcons name="microphone" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            editable={!loading}
          />
          <TouchableOpacity style={styles.sendIcon} onPress={sendMessage} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#6c9b9bcc" />
            ) : (
              <MaterialCommunityIcons name="send" size={24} color="#6c9b9bcc" />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
            <MaterialCommunityIcons name="calendar" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Chat')}>
            <MaterialCommunityIcons name="chat" size={24} color="#FFFFFF" /> 
            {hasUnreadSuggestions && <View style={styles.unreadDot} />}
            <Text style={styles.navLabelActive}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Projects')}>
            <MaterialCommunityIcons name="file-document-outline" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Projects</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
  headerRowTopLeft: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerTitle: {color: '#e0f0f0de', fontSize: 20, fontWeight: '400', marginLeft: 12 },
  messagesList: { flexGrow: 1, paddingBottom: 16 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, marginVertical: 5 },
  userBubble: { backgroundColor: '#1E1E1E', alignSelf: 'flex-end', borderTopRightRadius: 4 },
  assistantBubble: { backgroundColor: '#2A2A2A', alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  messageText: { fontSize: 16, color: '#FFFFFF' },
  timestamp: { fontSize: 10, color: '#AEAEB2', marginTop: 4, alignSelf: 'flex-end' },
  quickActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: 0, marginBottom: 12, marginTop: 8 },
  quickActionBubble: { width: '48.5%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 12, marginBottom: 10 },
  quickActionTitle: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', marginBottom: 3 },
  quickActionSubtitle: { fontSize: 13, color: '#B0B0B0' },
  inputSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 24, paddingHorizontal: 12, height: 48, marginBottom: 8 },
  micIcon: { marginRight: 8, padding: 4 },
  input: { flex: 1, fontSize: 16, color: '#FFFFFF', paddingVertical: 10 },
  sendIcon: { marginLeft: 8, padding: 4 },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  typingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#B0B0B0',
  },
  bottomNav: { 
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  navItem: { 
    alignItems: 'center', 
    flex: 1,
    paddingVertical: 4,
    opacity: 0.6
  },
  navItemActive: { 
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#1E1E1E', 
    padding: 8,              
    borderRadius: 12,        
    opacity: 1
  },
  navLabel: { color: '#B0B0B0', fontSize: 12, marginTop: 4 },
  navLabelActive: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    marginTop: 4, 
    fontWeight: '600'
  },
  unreadDot: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E0B0'
  },
});

export default ChatScreen;