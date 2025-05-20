import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import iconSet from '@expo/vector-icons/build/Fontisto';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
const AVATAR = 'https://api.dicebear.com/7.x/micah/svg?seed=Sarah';
const STUB_MEETINGS = [
  { id: 1, time: '9:00', period: 'AM', title: 'Board meeting', duration: '30 min', location: 'Zoom' },
  { id: 2, time: '2:00', period: 'PM', title: 'Client Meeting', duration: '1 hour', location: 'Office' },
];

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [meetings] = useState(STUB_MEETINGS);
  const [pendingTasks] = useState(new Array(7).fill(null));
  const [instruction, setInstruction] = useState({ visible: false, text: '', type: 'success' as 'success' | 'error' });
  const [hasUnreadSuggestions] = useState(true);

  useEffect(() => {
    setInstruction({ visible: true, text: 'Schedule updated successfully', type: 'success' });
    const timer = setTimeout(() => setInstruction(prev => ({ ...prev, visible: false })), 2000);
    return () => clearTimeout(timer);
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

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

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top - 12, paddingBottom: insets.bottom }]}>      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom + 56}
      >
        {/* Header Row 1 */}
        <View style={styles.headerRow}>
          <Image source={{ uri: AVATAR }} style={styles.avatar} />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialCommunityIcons name="file-multiple" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButtonBell}>
              <MaterialCommunityIcons name="bell" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Header Row 2 */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>Welcome back, Sarah</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Today's Meetings</Text>
            <Text style={styles.statsCount}>{meetings.length}</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Pending Tasks</Text>
            <Text style={styles.statsCount}>{pendingTasks.length}</Text>
          </View>
        </View>

        {/* Today's Schedule */}
        <View style={styles.scheduleContainer}>
          <View style={styles.scheduleContainerTop}>
            <Text style={styles.scheduleHeaderTitle}>Today's Schedule</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={meetings}
            renderItem={renderMeetingItem}
            keyExtractor={item => item.id.toString()}
            style={styles.scheduleList}
            scrollEnabled={false}
          />
        </View>

        {/* AI Instruction Banner */}
        {instruction.visible && (
          <View style={[styles.instructionBanner, instruction.type === 'error' ? styles.errorBanner : styles.successBanner]}>
            <Text style={styles.bannerText}>{instruction.text}</Text>
            <TouchableOpacity onPress={() => setInstruction(prev => ({ ...prev, visible: false }))}>
              <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputSection}>
          <TouchableOpacity style={styles.micIcon}>
            <MaterialCommunityIcons name="microphone" size={24} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a command or ask a question..."
            placeholderTextColor="#666"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendIcon}>
            <MaterialCommunityIcons name="send" size={24} color="#6c9b9bcc" />
          </TouchableOpacity>
        </View>

        {/* Standardized Bottom Nav */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home" size={24} color="#FFFFFF" />
            <Text style={styles.navLabelActive}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
            <MaterialCommunityIcons name="calendar" size={24} color="#B0B0B0" />
            <Text style={styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Chat')}>
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
  container: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  headerIcons: { flexDirection: 'row', marginLeft: 'auto' },
  iconButton: { marginLeft: 16 , backgroundColor: '#a3b3c229', padding: 10, borderRadius: '100%'},
  iconButtonBell: { marginLeft: 16 , backgroundColor: '#1e1e1eb3', padding: 10, borderRadius: '100%'},
  headerTextWrap: { flex: 1 },
  greeting: { color: '#e0f0f0de', fontSize: 20, fontWeight: '400' },
  dateText: { color: '#eeeeee8c', fontSize: 14, marginTop: 2 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 16 },
  statsCard: {
    width: '47.66%',
    height: 84,
    backgroundColor: '#242b335c',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  statsLabel: { fontSize: 14, color: '#e0f0f099' },
  statsCount: { fontSize: 24, color: '#e0f0f0de', marginTop: 4 },
  scheduleContainer: { flex: 1, width: '100%', marginTop: 18 },
  scheduleContainerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scheduleHeaderTitle: { fontSize: 16, fontWeight: '400', color: '#eeeeeee6' },
  viewAllButton: {},
  viewAllText: { fontSize: 14, color: '#a3b3c299' },
  scheduleList: { marginTop: 16 },
  scheduleItem: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: '#2d3a4a42',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  scheduleTime: { width: 60, alignItems: 'center' },
  scheduleTimeText: { fontSize: 16, fontWeight: '500', color: '#eeeeeee6' },
  scheduleTimeSubText: { fontSize: 14, color: '#a3b3c2b3', marginTop: 4 },
  scheduleDetails: { flex: 1, marginLeft: 12 },
  scheduleTitle: { fontSize: 16, fontWeight: '400', color: '#e0f0f0de' },
  scheduleSubText: { fontSize: 14, color: '#a3b3c275', marginTop: 4 },
  calendarIcon: { marginLeft: 12 , color: '#a3b3c299'},
  instructionBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  successBanner: { backgroundColor: 'rgba(0,223,168,0.2)' },
  errorBanner: { backgroundColor: 'rgba(255,59,48,0.2)' },
  bannerText: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  inputSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#40404033', borderRadius: 8, paddingHorizontal: 12, height: 48, marginBottom: 16 },
  micIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#FFFFFF' },
  sendIcon: { marginLeft: 12 },
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

export default HomeScreen;
