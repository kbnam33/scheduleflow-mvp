import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

type RootStackParamList = {
  Home: undefined;
  Calendar: undefined;
  Chat: undefined;
  Tasks: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const CalendarScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestedSlots, setSuggestedSlots] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [toast, setToast] = useState(null);
  const userId = 'test-user';
  const meetingId = 'meeting-123'; // Replace with real meeting id

  useEffect(() => {
    // Simulated data loading
    setLoading(false);
    setEvents([
      {
        id: 1,
        title: 'Team Meeting',
        time: '10:00 AM',
        duration: '1h',
        location: 'Conference Room',
        type: 'meeting',
      },
      {
        id: 2,
        title: 'Project Review',
        time: '2:00 PM',
        duration: '2h',
        location: 'Virtual',
        type: 'review',
      },
    ]);
  }, []);

  const handleSuggestPrep = async () => {
    setLoadingSuggest(true);
    setToast(null);
    try {
      const res = await axios.post('http://localhost:3001/api/suggest-prep-slot', { userId, meetingId });
      setSuggestedSlots(res.data.slots || []);
      if (!res.data.slots || res.data.slots.length === 0) setToast('No slots found. Try again.');
    } catch {
      setToast('Failed to suggest prep slots.');
    } finally {
      setLoadingSuggest(false);
    }
  };

  const handleConfirmPrep = async (slot) => {
    setToast(null);
    try {
      await axios.post('http://localhost:3001/api/confirm-prep-slot', { suggestionId: meetingId, chosenTime: slot });
      setToast('Prep slot confirmed!');
      setSuggestedSlots([]);
      setSelectedSlot(null);
    } catch {
      setToast('Failed to confirm slot.');
    }
  };

  const renderCalendarGrid = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          {days.map((day, index) => (
            <Text key={index} style={styles.calendarDayHeader}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {dates.map((date, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.calendarDate,
                date === selectedDate.getDate() && styles.selectedDate,
              ]}
              onPress={() => setSelectedDate(new Date(selectedDate.setDate(date)))}
            >
              <Text
                style={[
                  styles.calendarDateText,
                  date === selectedDate.getDate() && styles.selectedDateText,
                ]}
              >
                {date}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderEventCard = ({ item }: { item: any }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventTimeContainer}>
        <Text style={styles.eventTime}>{item.time}</Text>
        <Text style={styles.eventDuration}>{item.duration}</Text>
      </View>
      <View style={styles.eventDetails}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventLocation}>{item.location}</Text>
      </View>
      <TouchableOpacity style={styles.eventAction}>
        <MaterialCommunityIcons name="dots-vertical" size={20} color="#bfc6c9" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <TouchableOpacity style={styles.addButton}>
            <MaterialCommunityIcons name="plus" size={24} color="#e6ecec" />
          </TouchableOpacity>
        </View>

        {renderCalendarGrid()}

        <View style={styles.eventsContainer}>
          <Text style={styles.eventsTitle}>Today's Events</Text>
          <FlatList
            data={events}
            renderItem={renderEventCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.eventsList}
          />
        </View>

        {/* Add Suggest Prep button */}
        <TouchableOpacity onPress={handleSuggestPrep} style={{margin:16,padding:12,backgroundColor:'#00CFA8',borderRadius:8,alignItems:'center'}}>
          <Text style={{color:'#fff',fontWeight:'bold'}}>Suggest Prep</Text>
        </TouchableOpacity>
        {loadingSuggest && <ActivityIndicator color="#00CFA8" style={{margin:16}} />}

        {/* Overlay suggested slots as dashed blocks */}
        {suggestedSlots.map((slot, idx) => (
          <TouchableOpacity key={slot} onPress={() => setSelectedSlot(slot)} style={{position:'absolute',left:80,top:100+idx*70,right:20,height:56,borderWidth:1,borderColor:'#00CFA8',borderStyle:'dashed',borderRadius:8,backgroundColor:'#1E1E1E',padding:8,justifyContent:'center'}}>
            <Text style={{color:'#00CFA8',fontWeight:'bold'}}>{slot}</Text>
          </TouchableOpacity>
        ))}

        {/* Slot detail pane */}
        {selectedSlot && (
          <View style={{position:'absolute',left:20,right:20,top:300,backgroundColor:'#222',borderRadius:12,padding:20,zIndex:10}}>
            <Text style={{color:'#fff',fontSize:16,marginBottom:12}}>Prep Slot: {selectedSlot}</Text>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <TouchableOpacity onPress={() => handleConfirmPrep(selectedSlot)} style={{backgroundColor:'#00CFA8',borderRadius:18,paddingVertical:10,paddingHorizontal:24}}>
                <Text style={{color:'#fff',fontWeight:'bold'}}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedSlot(null)} style={{borderColor:'#00CFA8',borderWidth:1,borderRadius:18,paddingVertical:10,paddingHorizontal:24}}>
                <Text style={{color:'#00CFA8',fontWeight:'bold'}}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Toast */}
        {toast && (
          <View style={{position:'absolute',left:20,right:20,bottom:100,backgroundColor:'#1E1E1E',borderRadius:12,padding:16,alignItems:'center'}}>
            <Text style={{color:'#fff'}}>{toast}</Text>
          </View>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <MaterialCommunityIcons name="home" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItemActive}
          onPress={() => navigation.navigate('Calendar')}
        >
          <MaterialCommunityIcons name="calendar" size={24} color="#e6ecec" />
          <Text style={styles.navLabelActive}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Chat')}
        >
          <MaterialCommunityIcons name="chat" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Tasks')}
        >
          <MaterialCommunityIcons name="file-document-outline" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Tasks</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#181818',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarContainer: {
    backgroundColor: '#131616',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 24,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  calendarDayHeader: {
    color: '#bfc6c9',
    fontSize: 14,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDate: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedDate: {
    backgroundColor: '#e6ecec',
    borderRadius: 20,
  },
  calendarDateText: {
    color: '#bfc6c9',
    fontSize: 16,
  },
  selectedDateText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
  },
  eventsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eventsTitle: {
    color: '#bfc6c9',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  eventsList: {
    paddingBottom: 100,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#131616',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  eventTimeContainer: {
    width: 80,
  },
  eventTime: {
    color: '#bfc6c9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventDuration: {
    color: '#bfc6c9',
    fontSize: 13,
    marginTop: 2,
  },
  eventDetails: {
    flex: 1,
    marginLeft: 16,
  },
  eventTitle: {
    color: '#e6ecec',
    fontSize: 16,
    fontWeight: '600',
  },
  eventLocation: {
    color: '#bfc6c9',
    fontSize: 13,
    marginTop: 2,
  },
  eventAction: {
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

export default CalendarScreen;
