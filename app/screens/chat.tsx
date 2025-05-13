import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Easing,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingReply, setLoadingReply] = useState(false);

  const userId = 'test-user'; // Replace with real user id logic
  useEffect(() => {
    // Simulated data loading
    setLoading(false);
    setMessages([
      {
        id: 1,
        text: 'Can you help me prepare for the board meeting?',
        time: '10:30 AM',
        isUser: false,
      },
      {
        id: 2,
        text: 'I\'ll help you prepare for the board meeting. What specific aspects would you like to focus on?',
        time: '10:31 AM',
        isUser: true,
      },
      {
        id: 3,
        text: 'I need to review the Q4 financials and prepare a presentation.',
        time: '10:32 AM',
        isUser: false,
      },
    ]);

    // Fetch unread suggestions and inject as assistant messages
    const fetchSuggestions = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/suggestions?userId=${userId}`);
        const suggestions = res.data.suggestions || [];
        if (suggestions.length > 0) {
          const suggestionMessages = suggestions.map((s: any) => ({
            id: `sugg-${s.id}`,
            text: s.message,
            time: new Date(s.createdAt).toLocaleTimeString(),
            isUser: false,
          }));
          setMessages(msgs => [...suggestionMessages, ...msgs]);
          // Mark all as read
          await Promise.all(suggestions.map((s: any) => axios.post(`http://localhost:3001/api/suggestions/${s.id}/read`)));
        }
      } catch {}
    };
    fetchSuggestions();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoadingReply(true);
    const newMsg = { id: Date.now(), text: input, time: new Date().toLocaleTimeString(), isUser: true };
    const updatedHistory = [...messages, newMsg];
    setMessages(updatedHistory);
    setInput('');
    try {
      await AsyncStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
      const res = await axios.post('http://localhost:3001/api/chat', {
        userId: 'test-user',
        message: input,
        history: updatedHistory.map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.text }))
      });
      const aiMsg = { id: 'ai-' + Date.now(), text: res.data.reply, time: new Date().toLocaleTimeString(), isUser: false };
      const finalHistory = [...updatedHistory, aiMsg];
      setMessages(finalHistory);
      await AsyncStorage.setItem('chatHistory', JSON.stringify(finalHistory));
    } catch {
      const aiMsg = { id: 'ai-' + Date.now(), text: "I'm sorry, I couldn't process your request right now. Please try again or ask something else.", time: new Date().toLocaleTimeString(), isUser: false };
      setMessages(msgs => [...msgs, aiMsg]);
    } finally {
      setLoadingReply(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('chatHistory').then(data => {
      if (data) setMessages(JSON.parse(data));
    });
  }, []);

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessageContainer : styles.assistantMessageContainer
    ]}>
      <View style={[
        styles.messageBubble,
        item.isUser ? styles.userMessageBubble : styles.assistantMessageBubble
      ]}>
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.messageTime}>{item.time}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: 0, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, { paddingBottom: 76 + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chat</Text>
          </View>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[styles.messagesList, { paddingBottom: 100 }]}
          />
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.micButton}>
              <MaterialCommunityIcons name="microphone" size={20} color="#bfc6c9" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <MaterialCommunityIcons name="send" size={20} color="#bfc6c9" />
            </TouchableOpacity>
          </View>
          {loadingReply && (
            <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
              <View style={[styles.messageBubble, styles.assistantMessageBubble]}>
                <Text style={styles.messageText}>...</Text>
              </View>
            </View>
          )}
        </View>
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity 
            style={route.name === 'Home' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Home')}
          >
            <MaterialCommunityIcons name="home" size={24} color={route.name === 'Home' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Home' ? styles.navLabelActive : styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Calendar' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Calendar')}
          >
            <MaterialCommunityIcons name="calendar" size={24} color={route.name === 'Calendar' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Calendar' ? styles.navLabelActive : styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Chat' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Chat')}
          >
            <MaterialCommunityIcons name="chat" size={24} color={route.name === 'Chat' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Chat' ? styles.navLabelActive : styles.navLabel}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Tasks' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Tasks')}
          >
            <MaterialCommunityIcons name="file-document-outline" size={24} color={route.name === 'Tasks' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Tasks' ? styles.navLabelActive : styles.navLabel}>Tasks</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#e6ecec',
    fontSize: 24,
    fontWeight: 'bold',
  },
  messagesList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 16,
    borderRadius: 16,
  },
  userMessageBubble: {
    backgroundColor: '#181818',
  },
  assistantMessageBubble: {
    backgroundColor: '#131616',
  },
  messageText: {
    color: '#e6ecec',
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    color: '#bfc6c9',
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  micButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    color: '#e6ecec',
    fontSize: 16,
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    opacity: 0.6,
  },
  navItemActive: {
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 12,
    opacity: 1,
  },
  navLabel: {
    color: '#bfc6c9',
    fontSize: 12,
    marginTop: 4,
  },
  navLabelActive: {
    color: '#e6ecec',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
});

export default ChatScreen;
