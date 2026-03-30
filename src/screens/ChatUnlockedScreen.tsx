import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { listenToMatch } from '../services/matchingService';
import { sendMessage, listenToMessages } from '../services/chatService';
import { DiningMatch, ChatMessage, SearchStackParamList } from '../types';
import { useAuthStore } from '../hooks/useAuthStore';
import { COLORS, FONTS, SPACING } from '../utils/theme';

type RouteProps = RouteProp<SearchStackParamList, 'ChatUnlocked'>;

export default function ChatUnlockedScreen() {
  const { matchId } = useRoute<RouteProps>().params;
  const { user } = useAuthStore();

  const [match, setMatch] = useState<DiningMatch | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsubMatch = listenToMatch(matchId, setMatch);
    const unsubMsgs  = listenToMessages(matchId, (msgs) => {
      setMessages(msgs);
      // Auto-scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => { unsubMatch(); unsubMsgs(); };
  }, [matchId]);

  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    setSending(true);
    const text = inputText;
    setInputText('');
    try {
      await sendMessage(matchId, user.uid, text);
    } catch (err) {
      setInputText(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  if (!match) return null;

  const isUserA = match.userIdA === user?.uid;
  const partnerProfile = isUserA ? match.profileB : match.profileA;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{partnerProfile.name[0]}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{partnerProfile.name}</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>
              Online · {match.restaurant.name} · {formatTime(match.agreedTime)}
            </Text>
          </View>
        </View>
      </View>

      {/* Unlock banner */}
      <View style={styles.unlockBanner}>
        <View style={styles.greenDot} />
        <Text style={styles.unlockText}>
          You're both within 100m of {match.restaurant.name} — chat is open!
        </Text>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.messageId}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            return (
              <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperThem]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                    {item.text}
                  </Text>
                </View>
                <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : {}]}>
                  {formatTimestamp(item.createdAt)}
                </Text>
              </View>
            );
          }}
          ListHeaderComponent={() => (
            <Text style={styles.systemMsg}>
              Chat opened at {match.chatUnlockedAt ? formatTimestamp(match.chatUnlockedAt) : '—'} • you're both here!
            </Text>
          )}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.muted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={16} color={COLORS.cream} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: '#e8d8c8',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#e8d0f0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#c070e0',
  },
  avatarText: { fontFamily: FONTS.serifDisplay, fontSize: 18, color: '#8a40a0' },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: FONTS.serifDisplay, fontSize: 17, color: COLORS.deepBrown },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4a9a2a' },
  onlineText: { fontFamily: FONTS.sans, fontSize: 11, color: '#4a9a2a' },

  unlockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginTop: 10, marginBottom: 4,
    padding: 10, backgroundColor: '#e8f5e2',
    borderRadius: 10, borderWidth: 0.5, borderColor: '#b8dba0',
  },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a9a2a' },
  unlockText: { fontFamily: FONTS.sans, fontSize: 12, color: '#2a5a10', flex: 1 },

  messageList: { padding: SPACING.md, paddingBottom: 8 },
  systemMsg: {
    fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted,
    textAlign: 'center', marginBottom: 16,
  },
  msgWrapper: { marginBottom: 10, maxWidth: '75%' },
  msgWrapperMe: { alignSelf: 'flex-end' },
  msgWrapperThem: { alignSelf: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMe: { backgroundColor: COLORS.rust, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#f5e8d8', borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.cream },
  bubbleTextThem: { color: COLORS.deepBrown },
  msgTime: {
    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.muted,
    marginTop: 3, paddingHorizontal: 4,
  },
  msgTimeMe: { textAlign: 'right' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: SPACING.md, paddingTop: 10,
    borderTopWidth: 0.5, borderTopColor: '#e8d8c8',
  },
  input: {
    flex: 1, backgroundColor: '#f5e8d8',
    borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9,
    fontFamily: FONTS.sans, fontSize: 14, color: COLORS.deepBrown,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.rust, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d4b898' },
});
