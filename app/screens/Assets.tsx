import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import axios from 'axios';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const assets = [
  { id: '1', type: 'pdf', title: 'Project Brief.pdf', subtitle: 'Relevant to branding project', tags: ['Team meet', 'Client update call'] },
  { id: '2', type: 'image', title: 'Logo Design.ai', subtitle: 'Brand asset', tags: ['Client update call'] },
  { id: '3', type: 'doc', title: 'Branding call notes.docx', subtitle: 'Team meet', tags: ['Client update call'] },
  { id: '4', type: 'xlsx', title: 'Customer data.xlsx', subtitle: 'Target audience data', tags: ['Team meet'] },
];

const iconMap = {
  pdf: 'file-pdf',
  image: 'file-image',
  doc: 'file-word',
  xlsx: 'file-excel',
};

const AssetsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Assets'>>();
  const insets = useSafeAreaInsets();
  const [suggestedAssets, setSuggestedAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [toast, setToast] = useState(null);
  const projectId = 'project-123'; // Replace with real project id

  const handlePrepareDocs = async () => {
    setLoadingAssets(true);
    setToast(null);
    try {
      const res = await axios.post('http://localhost:3001/api/assets-query', { projectId });
      setSuggestedAssets(res.data.assets || []);
      if (!res.data.assets || res.data.assets.length === 0) setToast('No suggestions found.');
    } catch {
      setToast('Failed to fetch suggestions.');
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleUpload = (idx) => {
    // Simulate upload and replace suggestion with a real file link
    setSuggestedAssets(prev => prev.map((a, i) => i === idx ? { ...a, url: 'https://uploaded.example.com/' + a.filename } : a));
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: 0, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, paddingBottom: 76 + insets.bottom }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Assets</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity>
              <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={assets}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.assetCard}>
                <MaterialCommunityIcons name={iconMap[item.type]} size={32} color="#fff" style={{ marginRight: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.assetTitle}>{item.title}</Text>
                  <Text style={styles.assetSubtitle}>{item.subtitle}</Text>
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                    ))}
                  </View>
                </View>
                <View style={styles.assetActions}>
                  <TouchableOpacity style={styles.assetActionBtn}>
                    <MaterialCommunityIcons name="download" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.assetActionBtn}>
                    <MaterialCommunityIcons name="share-variant" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <TouchableOpacity style={styles.addAssetBtn}>
            <MaterialCommunityIcons name="plus" size={32} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrepareDocs} style={{margin:16,padding:12,backgroundColor:'#00CFA8',borderRadius:8,alignItems:'center'}}>
            <Text style={{color:'#fff',fontWeight:'bold'}}>Prepare Docs</Text>
          </TouchableOpacity>
          {loadingAssets && <ActivityIndicator color="#00CFA8" style={{margin:16}} />}
          {suggestedAssets.length > 0 && suggestedAssets.map((asset, idx) => (
            <View key={asset.filename || idx} style={{flexDirection:'row',alignItems:'center',backgroundColor:'#1E1E1E',borderRadius:12,padding:12,marginVertical:8}}>
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
            <View style={{position:'absolute',left:20,right:20,bottom:100,backgroundColor:'#1E1E1E',borderRadius:12,padding:16,alignItems:'center'}}>
              <Text style={{color:'#fff'}}>{toast}</Text>
            </View>
          )}
        </View>
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home" size={24} color="#666" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
            <MaterialCommunityIcons name="calendar" size={24} color="#666" />
            <Text style={styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Chat')}>
            <MaterialCommunityIcons name="chat" size={24} color="#666" />
            <Text style={styles.navLabel}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItemActive}>
            <MaterialCommunityIcons name="file-document-outline" size={24} color="#fff" />
            <Text style={styles.navLabelActive}>Assets</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '500', marginLeft: 16 },
  assetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', borderRadius: 12, height: 80, marginVertical: 8, padding: 12 },
  assetTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  assetSubtitle: { color: '#A0A0A0', fontSize: 12, marginTop: 2 },
  tagsRow: { flexDirection: 'row', marginTop: 4 },
  tag: { height: 24, backgroundColor: '#272727', borderRadius: 12, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  tagText: { color: '#A0A0A0', fontSize: 12 },
  assetActions: { flexDirection: 'row', marginLeft: 8 },
  assetActionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', marginLeft: 8 },
  addAssetBtn: { position: 'absolute', right: 16, bottom: 80, width: 56, height: 56, borderRadius: 28, backgroundColor: '#00CFA8', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#2A2A2A', height: 56, paddingHorizontal: 24, position: 'absolute', left: 0, right: 0, bottom: 0 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 48, paddingVertical: 4 },
  navItemActive: { alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 48, paddingVertical: 4 },
  navLabel: { color: '#666', fontSize: 12, fontWeight: '500', marginTop: 4 },
  navLabelActive: { color: '#fff', fontSize: 12, fontWeight: '500', marginTop: 4 },
});
// git change.

export default AssetsScreen; 