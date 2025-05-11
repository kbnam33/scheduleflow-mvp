import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
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

const AVATAR = 'https://api.dicebear.com/7.x/micah/svg?seed=Sarah'; // Placeholder avatar

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [input, setInput] = useState('');
  // Hardcoded data for UI
  const meetings = [
    { id: 1, title: 'Board meeting', time: '9:00 AM', duration: '30 min', location: 'Zoom' },
    { id: 2, title: 'Client Meeting', time: '2:00 PM', duration: '1 hour', location: 'Office' },
    { id: 3, title: 'Design Review', time: '4:00 PM', duration: '45 min', location: 'Zoom' },
    { id: 4, title: 'Team Sync', time: '5:30 PM', duration: '30 min', location: 'Zoom' },
  ];
  const tasks = [1,2,3,4,5,6,7];
  const schedule = meetings;

  // Simulate user name
  const name = 'Sarah';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
  });

  const [hasUnreadSuggestions, setHasUnreadSuggestions] = useState(false);
  const userId = 'test-user'; // Replace with real user id logic
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/suggestions?userId=${userId}`);
        setHasUnreadSuggestions(res.data.suggestions && res.data.suggestions.length > 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  // Skeleton loader for cards
  const CardSkeleton = () => (
    <View style={[styles.card, { opacity: 0.3 }]}> <ActivityIndicator color="#222" /> </View>
  );

  // Skeleton loader for schedule
  const ScheduleSkeleton = () => (
    <View style={styles.scheduleItemSkeleton} />
  );

  const [showMeetingDetail, setShowMeetingDetail] = useState(false);
  const [suggestedAssets, setSuggestedAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [toast, setToast] = useState(null);
  const meetingId = 'meeting-123'; // Replace with real meeting id

  const handlePrepareDocs = async () => {
    setLoadingAssets(true);
    setToast(null);
    try {
      const res = await axios.post('http://localhost:3001/api/assets-query', { meetingId });
      setSuggestedAssets(res.data.assets || []);
      if (!res.data.assets || res.data.assets.length === 0) setToast('No suggestions found.');
    } catch {
      setToast('Failed to fetch suggestions.');
    } finally {
      setLoadingAssets(false);
    }
  };
  const handleUpload = (idx) => {
    setSuggestedAssets(prev => prev.map((a, i) => i === idx ? { ...a, url: 'https://uploaded.example.com/' + a.filename } : a));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={{ uri: AVATAR }} style={styles.avatar} />
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="clipboard-text" size={20} color="#bfc6c9" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialCommunityIcons name="bell" size={20} color="#bfc6c9" />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>Welcome back, {name}</Text>
        <Text style={styles.date}>{dateStr}</Text>

        {/* Cards */}
        <View style={styles.cardsRow}>
          {meetings.length === 0 ? <CardSkeleton /> : (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Today's Meetings</Text>
              <Text style={styles.cardValue}>{meetings.length}</Text>
            </View>
          )}
          {tasks.length === 0 ? <CardSkeleton /> : (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Pending Tasks</Text>
              <Text style={styles.cardValue}>{tasks.length}</Text>
            </View>
          )}
        </View>

        {/* Schedule */}
        <View style={styles.scheduleHeaderRow}>
          <Text style={styles.scheduleHeader}>Today's Schedule</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scheduleContainer}>
          {schedule.length === 0 ? (
            <>
              <ScheduleSkeleton />
              <ScheduleSkeleton />
            </>
          ) : (
            <FlatList
              data={schedule}
              keyExtractor={item => item.id?.toString() || Math.random().toString()}
              renderItem={({ item }) => (
                <View style={styles.scheduleItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.scheduleTime}>{item.time}</Text>
                    <View style={{ marginLeft: 16 }}>
                      <Text style={styles.scheduleTitle}>{item.title}</Text>
                      <Text style={styles.scheduleMeta}>{item.duration} · {item.location}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.scheduleCalBtn}>
                    <MaterialCommunityIcons name="calendar" size={20} color="#bfc6c9" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No meetings today.</Text>}
            />
          )}
        </View>

        {/* Last thread */}
        <View style={styles.lastThreadRow}>
          <Text style={styles.lastThreadLabel}>Last thread</Text>
          <Text style={styles.lastThreadText} numberOfLines={1}>Help me prepare for the board meeting</Text>
        </View>

        {/* Chat input */}
        <View style={styles.chatInputRow}>
          <TouchableOpacity style={styles.micBtn}>
            <MaterialCommunityIcons name="microphone" size={20} color="#bfc6c9" />
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            placeholder="Ask me anything..."
            placeholderTextColor="#666"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendBtn}>
            <MaterialCommunityIcons name="send" size={20} color="#bfc6c9" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItemActive}
          onPress={() => navigation.navigate('Home')}
        >
          <MaterialCommunityIcons name="home" size={24} color="#e6ecec" />
          <Text style={styles.navLabelActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Calendar')}
        >
          <MaterialCommunityIcons name="calendar" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => {
            setHasUnreadSuggestions(false);
            navigation.navigate('Chat');
          }}
        >
          <MaterialCommunityIcons name="chat" size={24} color="#bfc6c9" />
          {hasUnreadSuggestions && <View style={{position:'absolute',top:6,right:18,width:8,height:8,borderRadius:4,backgroundColor:'#00CFA8'}} />}
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

      {/* Example meeting detail modal */}
      {showMeetingDetail && (
        <View style={{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#000a',zIndex:20,justifyContent:'center',alignItems:'center'}}>
          <View style={{backgroundColor:'#1E1E1E',borderRadius:16,padding:24,width:'90%'}}>
            <Text style={{color:'#fff',fontSize:18,fontWeight:'bold',marginBottom:12}}>Meeting Details</Text>
            <TouchableOpacity onPress={handlePrepareDocs} style={{margin:8,padding:10,backgroundColor:'#00CFA8',borderRadius:8,alignItems:'center'}}>
              <Text style={{color:'#fff',fontWeight:'bold'}}>Prepare Docs</Text>
            </TouchableOpacity>
            {loadingAssets && <ActivityIndicator color="#00CFA8" style={{margin:16}} />}
            {suggestedAssets.length > 0 && suggestedAssets.map((asset, idx) => (
              <View key={asset.filename || idx} style={{flexDirection:'row',alignItems:'center',backgroundColor:'#222',borderRadius:12,padding:12,marginVertical:8}}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color="#00CFA8" style={{marginRight:12}} />
                <Text style={{color:'#fff',flex:1}}>{asset.filename}</Text>
                {asset.url ? (
                  <Text style={{color:'#00CFA8',marginRight:8}}>Uploaded</Text>
                ) : (
                  <TouchableOpacity onPress={() => handleUpload(idx)} style={{backgroundColor:'#00CFA8',borderRadius:8,paddingVertical:6,paddingHorizontal:12}}>
                    <Text style={{color:'#fff'}}>Upload</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {toast && (
              <View style={{backgroundColor:'#1E1E1E',borderRadius:12,padding:16,alignItems:'center',marginTop:12}}>
                <Text style={{color:'#fff'}}>{toast}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setShowMeetingDetail(false)} style={{marginTop:16,alignItems:'center'}}>
              <Text style={{color:'#00CFA8',fontWeight:'bold'}}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  iconBtn: {
    marginLeft: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#181818',
  },
  greeting: {
    color: '#e6ecec',
    fontSize: 24,
    fontWeight: '500',
    marginLeft: 20,
    marginTop: 8,
  },
  date: {
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '400',
    marginLeft: 20,
    marginBottom: 18,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  cardLabel: {
    color: '#bfc6c9',
    fontSize: 15,
    marginBottom: 8,
  },
  cardValue: {
    color: '#e6ecec',
    fontSize: 28,
    fontWeight: 'bold',
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  scheduleHeader: {
    color: '#bfc6c9',
    fontSize: 16,
    fontWeight: '600',
  },
  viewAll: {
    color: '#A0A0A0',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  scheduleContainer: {
    flex: 1,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    justifyContent: 'space-between',
  },
  scheduleItemSkeleton: {
    height: 60,
    backgroundColor: '#181818',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  scheduleTime: {
    color: '#bfc6c9',
    fontSize: 16,
    width: 54,
    fontWeight: 'bold',
  },
  scheduleTitle: {
    color: '#e6ecec',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleMeta: {
    color: '#bfc6c9',
    fontSize: 13,
    marginTop: 2,
  },
  scheduleCalBtn: {
    backgroundColor: '#181818',
    borderRadius: 8,
    padding: 8,
  },
  emptyText: {
    color: '#bfc6c9',
    textAlign: 'center',
    marginTop: 16,
  },
  lastThreadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
  },
  lastThreadLabel: {
    color: '#bfc6c9',
    fontSize: 13,
    marginRight: 8,
  },
  lastThreadText: {
    color: '#e6ecec',
    fontSize: 14,
    flex: 1,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 25,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
  },
  micBtn: {
    marginRight: 8,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#131616',
  },
  chatInput: {
    flex: 1,
    color: '#e6ecec',
    fontSize: 15,
    paddingHorizontal: 10,
    height: 50,
  },
  sendBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#131616',
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

export default HomeScreen;
