import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const AVATAR = 'https://api.dicebear.com/7.x/micah/svg?seed=Sarah';
const STUB_MEETINGS = [
  { id: 1, time: '9:00', period: 'AM', title: 'Board meeting', duration: '30 min', location: 'Zoom' },
  { id: 2, time: '2:00', period: 'PM', title: 'Client Meeting', duration: '1 hour', location: 'Office' },
];

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [meetings] = useState(STUB_MEETINGS);
  const [pendingTasks] = useState(new Array(7).fill(null));
  const [lastThread] = useState('Help me prepare for the board meeting');
  const [hasUnreadSuggestions] = useState(true);
  const [loadingReply, setLoadingReply] = useState(false);
  const [aiReply, setAiReply] = useState('');

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
  });

  const renderMeetingItem = ({ item }) => (
    <View style={styles.scheduleItem}>
      <View style={styles.scheduleTime}>
        <Text style={styles.scheduleTimeText}>{item.time}</Text>
        <Text style={styles.scheduleTimeSubText}>{item.period}</Text>
      </View>
      <View style={styles.scheduleDetails}>
        <Text style={styles.scheduleTitle}>{item.title}</Text>
        <Text style={styles.scheduleSubText}>{`${item.duration} · ${item.location}`}</Text>
      </View>
      <TouchableOpacity style={styles.calendarIcon}>
        <MaterialCommunityIcons name="calendar" size={24} color="#B0B0B0" />
      </TouchableOpacity>
    </View>
  );

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoadingReply(true);
    setAiReply('');
    try {
      const res = await axios.post('http://localhost:3001/api/chat', {
        userId: 'test-user',
        message: input,
        history: [],
      });
      setAiReply(res.data.reply);
    } catch {
      setAiReply("I'm sorry, I couldn't process your request right now. Please try again or ask something else.");
    } finally {
      setLoadingReply(false);
      setInput('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212', paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" translucent={true} />
      <View style={{ flex: 1 }}>
        {/* Main content (not affected by keyboard) */}
        <View style={[styles.container, { paddingBottom: 0 }]}> 
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Image source={{ uri: AVATAR }} style={styles.avatar} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.assetIconWrap} onPress={() => navigation.navigate('Assets')}>
              <View style={styles.assetIconCircle}>
                <MaterialCommunityIcons name="clipboard" size={22} color="#00E0B0" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialCommunityIcons name="bell" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {/* Welcome and Date */}
          <View style={styles.welcomeWrap}>
            <Text style={styles.greeting}>Welcome back, Sarah</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Today's Meetings</Text>
              <Text style={styles.statsCount}>{meetings.length}</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>Pending Tasks</Text>
              <Text style={styles.statsCount}>{pendingTasks.length}</Text>
            </View>
          </View>
          {/* Schedule */}
          <View style={styles.scheduleSection}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleHeaderTitle}>Today's Schedule</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={meetings}
              renderItem={renderMeetingItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          </View>
        </View>
        {/* Only bottomArea is affected by keyboard */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 }}
        >
          <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 74 }]}> 
            <View style={styles.lastThreadPill}>
              <Text style={styles.lastThreadText}>{lastThread}</Text>
            </View>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.micIcon}>
                <MaterialCommunityIcons name="microphone" size={20} color="#bfc6c9" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Ask me anything..."
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
                editable={!loadingReply}
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loadingReply}>
                <MaterialCommunityIcons name="send" size={20} color="#bfc6c9" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        {/* Bottom nav (never moves) */}
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none"> 
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
            {hasUnreadSuggestions && <View style={styles.unreadDot} />}
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 0,
    minHeight: 48,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  assetIconWrap: { marginLeft: 12 },
  assetIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,224,176,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: { marginLeft: 12 },
  welcomeWrap: {
    marginTop: 8,
    marginBottom: 20,
  },
  greeting: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 2 },
  dateText: { color: '#B0B0B0', fontSize: 15, fontWeight: '400' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 16,
  },
  statsCard: {
    flex: 1,
    height: 68,
    backgroundColor: '#181818',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statsLabel: { fontSize: 15, color: '#B0B0B0', fontWeight: '500' },
  statsCount: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 6 },
  scheduleSection: { marginBottom: 24 },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  viewAllText: { fontSize: 15, color: '#00E0B0', fontWeight: '500' },
  scheduleItem: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scheduleTime: { width: 60, alignItems: 'center' },
  scheduleTimeText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  scheduleTimeSubText: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },
  scheduleDetails: { flex: 1, marginLeft: 12 },
  scheduleTitle: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  scheduleSubText: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },
  calendarIcon: { marginLeft: 12 },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  lastThreadPill: {
    backgroundColor: '#232323',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  lastThreadText: { fontSize: 15, color: '#FFFFFF', fontWeight: '200' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  micIcon: { padding: 8 },
  input: {
    flex: 1,
    color: '#e6ecec',
    fontSize: 16,
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  sendButton: { padding: 8 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  navItem: { alignItems: 'center' },
  navItemActive: {
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 12,
  },
  navLabel: { color: '#B0B0B0', fontSize: 12, marginTop: 4 },
  navLabelActive: { color: '#FFFFFF', fontSize: 12, marginTop: 4, fontWeight: '600' },
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E0B0',
  },
});

export default HomeScreen;
