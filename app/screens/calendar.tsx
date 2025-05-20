import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

const STUB_EVENTS = [
  { id: 1, time: '9:00', period: 'AM', title: 'Client update call', duration: '30 minutes', location: 'Zoom', assets: 3 },
  { id: 2, time: '10:00', period: 'AM', title: 'Board Meeting Prep', duration: '1 hr', location: 'Zoom', assets: 3 },
];

const CalendarScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events] = useState(STUB_EVENTS);
  const [hasUnreadSuggestions] = useState(true);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const goPrevious = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'Day') d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const goNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'Day') d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const renderEvent = ({ item }: { item: typeof STUB_EVENTS[0] }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventTime}>
        <Text style={styles.eventTimeText}>{item.time}</Text>
        <Text style={styles.eventPeriodText}>{item.period}</Text>
      </View>
      <View style={styles.eventDetails}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventSubText}>
          {`${item.duration} · ${item.location} · ${item.assets} assets`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top - 12, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerRowTopLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#a3b3c2b3" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Calendar</Text>
          </View>
          <TouchableOpacity>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#a3b3c299" />
          </TouchableOpacity>
        </View>

        {/* Tabs + Date Nav Row */}
        <View style={styles.tabsDateRow}>
          {/* Mode Tabs */}
          <View style={styles.tabsRow}>
            {['Day', 'Week', 'Month'].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.tab, viewMode === mode && styles.tabActive]}
                onPress={() => setViewMode(mode as any)}
              >
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Date Navigator */}
          <View style={styles.dateNavRow}>
            <TouchableOpacity onPress={goPrevious}>
              <MaterialCommunityIcons name="chevron-left" size={20} color="#eeeeeeb3" />
            </TouchableOpacity>
            <Text style={styles.dateNavText}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity onPress={goNext}>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#eeeeeeb3" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Events List */}
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home" size={24} color="#FFFFFF" />
            <Text style={styles.navLabelActive}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Calendar')}>
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
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  headerRowTopLeft:{
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerTitle: {color: '#e0f0f0de', fontSize: 20, fontWeight: '400', marginLeft: 12 },
  tabsDateRow: {width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 },
  tabsRow: { flexDirection: 'row' },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#1E1E1E', marginRight: 8 },
  tabActive: { backgroundColor: '#242b33b3' },
  tabText: { fontSize: 14, color: '#B0B0B0' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '400' },
  dateNavRow: { flexDirection: 'row', alignItems: 'center' },
  dateNavText: { color: '#eeeeeee6', fontSize: 16, fontWeight: '500', marginHorizontal: 8 },
  listContent: { paddingBottom: 100 },
  eventCard: {
    flexDirection: 'row',
    height: 72,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  eventTime: { width: 60, alignItems: 'center' },
  eventTimeText: { fontSize: 16, fontWeight: '500', color: '#eeeeeee6' },
  eventPeriodText: { fontSize: 14, color: '#b0b0b0cc', marginTop: 4 },
  eventDetails: { flex: 1, marginLeft: 12, backgroundColor: '#242b3347', borderRadius: 12, width: '100%', height: '100%', paddingVertical: 11, paddingHorizontal: 13},
  eventTitle: { fontSize: 16, fontWeight: '400', color: '#e0f0f0de' },
  eventSubText: { fontSize: 14, color: '#a3b3c299', marginTop: 4 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 12,
  },
  navItem: { alignItems: 'center', opacity: 0.6 },
  navItemActive: {
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 12,
    opacity: 1,
  },
  navLabel: { color: '#B0B0B0', fontSize: 12, marginTop: 4 },
  navLabelActive: { color: '#FFFFFF', fontSize: 12, marginTop: 4, fontWeight: '600' },
  unreadDot: { position: 'absolute', top: 4, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E0B0' },
});
// git change..

export default CalendarScreen;
