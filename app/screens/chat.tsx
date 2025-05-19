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
  Alert,
  StatusBar, // Added StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import axios from 'axios';

// Ensure your backend URL is correctly configured
// For Android emulator, 10.0.2.2 typically maps to your host machine's localhost
// For iOS simulator, localhost usually works directly.
// For physical devices, use your machine's network IP.
const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

type Message = { id: string; text: string; sender: 'user' | 'assistant'; timestamp: string };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const STUB_QUICK_ACTIONS = [
  { id: '1', title: 'Plan my day', subtitle: 'What should I focus on?' },
  { id: '2', title: 'Suggest a break', subtitle: 'Feeling a bit tired.' },
  { id: '3', title: 'Upcoming meetings?', subtitle: 'Check my schedule.' },
  { id: '4', title: 'New project idea', subtitle: 'Help me outline it.' },
];

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [hasUnreadSuggestions, setHasUnreadSuggestions] = useState(true); // Mock state for unread dot

  // Store chat history for sending to backend
  const [chatHistoryForAI, setChatHistoryForAI] = useState<Array<{role: string, content: string}>>([]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessageText = input;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setTyping(true);

    const currentHistory = [...chatHistoryForAI, { role: 'user', content: userMessageText }];
    const historyToSend = currentHistory.slice(-10); // Keep last 10 for context
    setChatHistoryForAI(historyToSend); // Update state for next turn if needed

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, {
        message: userMessageText,
        chatHistory: historyToSend, // Sending history to backend
        // userId: 'test-user-id', // This should be handled by your auth middleware via token
      },
      {
        // If you have auth tokens, include them here
        // headers: { 'Authorization': `Bearer YOUR_JWT_TOKEN` }
      });
      
      const aiResponseData = response.data;

      if (aiResponseData.error && !aiResponseData.message) { // Handle backend error structure
         throw new Error(aiResponseData.message || "AI processing failed without a message.");
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponseData.message,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      setChatHistoryForAI(prev => [...prev, {role: 'assistant', content: aiResponseData.message}].slice(-10));

      if (aiResponseData.createdTask && aiResponseData.createdTask.id) {
        Alert.alert(
          "Task Created!",
          `Task "${aiResponseData.createdTask.title}" has been added.`,
          [
            { text: "OK" },
            { text: "View Task", onPress: () => navigation.navigate('Tasks', { projectId: aiResponseData.createdTask.project_id || 'all', projectTitle: 'Tasks' }) }
          ]
        );
      } else if (aiResponseData.suggestedActions?.some(action => action.type === 'CREATE_TASK_SUGGESTION')) {
        const taskSuggestion = aiResponseData.suggestedActions.find(action => action.type === 'CREATE_TASK_SUGGESTION');
        if (taskSuggestion) {
          Alert.alert(
            "Create Task?",
            taskSuggestion.description + `\n\nBased on: "${taskSuggestion.payload?.originalMessage || userMessageText}"`,
            [
              { text: "No", style: "cancel" },
              { 
                text: "Yes", 
                onPress: () => {
                  // Option 1: Send a new message with explicit intent
                  // This requires the backend to parse "Create a task: ..." differently or use same NL processing
                  const taskCreationMessage = `Create a task: ${taskSuggestion.payload?.originalMessage || userMessageText}`;
                  setInput(taskCreationMessage); 
                  // Optionally auto-send:
                  // setInput(taskCreationMessage);
                  // setTimeout(() => sendMessage(), 100); // Send after state updates
                }
              }
            ]
          );
        }
      }

    } catch (error: any) {
      console.error("Error sending message or processing AI response:", error.response?.data || error.message || error);
      const errorText = error.response?.data?.message || error.message || "I'm having trouble connecting. Please try again.";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
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
        <Text style={isUser ? styles.userText : styles.assistantText}>{item.text}</Text>
        <Text style={isUser ? styles.userTimestamp : styles.assistantTimestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" translucent={false} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + insets.bottom + 56) : 0} // Adjust offset as needed
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerRowTopLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#a3b3c2b3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>AI Assistant</Text>
          </View>
          <TouchableOpacity style={styles.menuButton}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#a3b3c299" />
          </TouchableOpacity>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={ // Show quick actions only if no messages
            <View style={styles.quickActionsContainer}>
              {STUB_QUICK_ACTIONS.map(action => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickActionBubble}
                  onPress={() => {
                    setInput(`${action.title}: ${action.subtitle}`);
                  }}
                >
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        {/* Typing Indicator */}
        {typing && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingText}>AI is typing</Text>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
        </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputSection, { marginBottom: Platform.OS === 'ios' ? 0 : 8 }]}>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialCommunityIcons name="microphone-outline" size={24} color="#B0B0B0" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#8E8E93"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false} 
            multiline
          />
          <TouchableOpacity style={styles.iconButton} onPress={sendMessage} disabled={typing || !input.trim()}>
            <MaterialCommunityIcons name="send-circle" size={28} color={typing || !input.trim() ? "#4A4A4A" : "#00E0B0"} />
          </TouchableOpacity>
        </View>

        {/* Bottom Nav (Assuming this is part of a StackNavigator and not a TabNavigator for now) */}
        {/* If this screen is part of a TabNavigator, this bottomNav should be removed and handled by the TabBar component */}
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home-variant-outline" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Chat')}>
            <MaterialCommunityIcons name="chat-processing" size={24} color="#FFFFFF" />
            {hasUnreadSuggestions && <View style={styles.unreadDot} />}
            <Text style={styles.navLabelActive}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Projects')}>
            <MaterialCommunityIcons name="folder-outline" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Projects</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, backgroundColor: '#121212'}, // Removed default paddingHorizontal
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16, // Adjust for status bar
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A33'
  },
  headerRowTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4, // Make tap target larger
    marginRight: 8,
  },
  headerTitle: { color: '#E0F0F0DE', fontSize: 20, fontWeight: '500' },
  menuButton: {
    padding: 4,
  },
  messagesList: { 
    flexGrow: 1, 
    paddingHorizontal: 16, 
    paddingBottom: 8 
  },
  messageBubble: { 
    maxWidth: '80%', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 18, 
    marginVertical: 6,
    minWidth: 80, // Ensure bubble has some width for timestamp
  },
  userBubble: { 
    backgroundColor: '#007AFF', // iOS blue
    alignSelf: 'flex-end', 
    borderTopRightRadius: 6, // Slight variation
    borderBottomRightRadius: 18,
  },
  assistantBubble: { 
    backgroundColor: '#2C2C2E', // iOS dark grey
    alignSelf: 'flex-start', 
    borderTopLeftRadius: 6, // Slight variation
    borderBottomLeftRadius: 18,
  },
  userText: { fontSize: 16, color: '#FFFFFF', lineHeight: 22 },
  assistantText: { fontSize: 16, color: '#FFFFFF', lineHeight: 22 },
  timestamp: { fontSize: 11, color: '#AEAEB2', marginTop: 4, alignSelf: 'flex-end' }, // Generic timestamp style
  userTimestamp: { fontSize: 11, color: '#E5E5EA', marginTop: 4, alignSelf: 'flex-end', opacity: 0.8 },
  assistantTimestamp: { fontSize: 11, color: '#8E8E93', marginTop: 4, alignSelf: 'flex-end' },
  quickActionsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A33'
  },
  quickActionBubble: {
    width: '48%', // Two per row with small gap
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  quickActionTitle: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', textAlign: 'center' },
  quickActionSubtitle: { fontSize: 12, color: '#B0B0B0', marginTop: 3, textAlign: 'center' },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A66',
  },
  iconButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingHorizontal: 8,
    maxHeight: 100, // For multiline input
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 24, // Align with assistant bubbles
    alignSelf: 'flex-start',
  },
  typingText: {
    color: '#8E8E93',
    fontSize: 14,
    marginRight: 8,
    fontStyle: 'italic',
  },
  // ... other styles
typingDot: { 
  width: 7, 
  height: 7, 
  borderRadius: 3.5, 
  backgroundColor: '#8E8E93', 
  marginHorizontal: 3,
  // For a true staggered animation, we would use Animated.View and Animated.timing/sequence
  // For now, to fix the TS error, remove animationDelay. They will appear simultaneously.
},
// ...,
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1C1C1E', // Slightly different from page bg for separation
    paddingVertical: 6, // Reduced padding
    borderTopWidth: 1,
    borderTopColor: '#3A3A3C', // More prominent separator
  },
  navItem: { alignItems: 'center', flex: 1, paddingVertical: 4 },
  navItemActive: { alignItems: 'center', flex: 1, paddingVertical: 4 }, // Removed distinct background for active tab, rely on icon/text color
  navLabel: { color: '#8E8E93', fontSize: 10, marginTop: 2 },
  navLabelActive: { color: '#00E0B0', fontSize: 10, marginTop: 2, fontWeight: '600' },
  unreadDot: {
    position: 'absolute',
    top: -2, // Adjusted for icon size
    right: -4, // Adjusted for icon size
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E0B0',
    borderWidth: 1,
    borderColor: '#121212' // To make it pop
  },
});

export default ChatScreen;