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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Message = { id: string; text: string; sender: 'user' | 'assistant'; timestamp: string };
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

const STUB_QUICK_ACTIONS = [
  { id: '1', title: 'Reschedule', subtitle: 'I cannot attend a meeting' },
  { id: '2', title: 'Update a document', subtitle: 'Summarize meeting notes' },
  { id: '3', title: 'Create a plan', subtitle: 'Complete pending tasks' },
  { id: '4', title: 'Notify Team', subtitle: 'Upcoming meeting' },
];

const ChatScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const [hasUnreadSuggestions] = useState(true);

  useEffect(() => {
    // load initial messages
  }, []);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    // simulate AI typing
    setTyping(true);
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now()+1).toString(),
        text: "I'm sorry, I couldn't process your request right now.",
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
      setTyping(false);
    }, 1500);
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
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top - 12, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom + 56}
      >
        {/* Header */}
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

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          {STUB_QUICK_ACTIONS.map(action => (
            <TouchableOpacity key={action.id} style={styles.quickActionBubble}>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Bar */}
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
          />
          <TouchableOpacity style={styles.sendIcon} onPress={sendMessage}>
            <MaterialCommunityIcons name="send" size={24} color="#6c9b9bcc" />
          </TouchableOpacity>
        </View>

        {/* Typing Indicator */}
        {typing && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, { opacity: 0.6 }]} />
            <View style={styles.typingDot} />
          </View>
        )}

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home" size={24} color="#FFFFFF" />
            <Text style={styles.navLabelActive}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
            <MaterialCommunityIcons name="calendar" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Chat')}>
            <MaterialCommunityIcons name="chat" size={24} color="#B0B0B0" />
            {hasUnreadSuggestions && <View style={styles.unreadDot} />}
            <Text style={styles.navLabel}>Chat</Text>
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
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 12, marginVertical: 4 },
  userBubble: { backgroundColor: '#1E1E1E', alignSelf: 'flex-end', borderTopRightRadius: 0 },
  assistantBubble: { backgroundColor: '#2A2A2A', alignSelf: 'flex-start', borderTopLeftRadius: 0 },
  userText: { fontSize: 16, color: '#FFFFFF' },
  assistantText: { fontSize: 16, color: '#FFFFFF' },
  timestamp: { fontSize: 12, color: '#B0B0B0', marginTop: 4, alignSelf: 'flex-end' },
  quickActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 16 },
  quickActionBubble: { width: '48%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 12, marginBottom: 16 },
  quickActionTitle: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  quickActionSubtitle: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },
  inputSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#40404033', borderRadius: 8, paddingHorizontal: 12, height: 48, marginBottom: 16 },
  micIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#FFFFFF' },
  sendIcon: { marginLeft: 12 },
  typingIndicator: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', marginHorizontal: 4 },
  bottomNav: { 
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 12,
  },
  navItem: { alignItems: 'center', opacity: 0.6 },
  navItemActive: { alignItems: 'center', backgroundColor: '#1E1E1E', padding: 8, borderRadius: 12, opacity: 1 },
  navLabel: { color: '#B0B0B0', fontSize: 12, marginTop: 4 },
  navLabelActive: { color: '#FFFFFF', fontSize: 12, marginTop: 4, fontWeight: '600' },
  unreadDot: { position: 'absolute', top: 4, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E0B0' },
});
// git change..

export default ChatScreen;