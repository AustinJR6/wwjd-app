import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Button,
    Alert
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import ScreenContainer from '../components/theme/ScreenContainer';
import { theme } from '../components/theme/theme';
import { ASK_GEMINI_FUNCTION } from '../utils/constants';

export default function StreakScreen() {
    const [streak, setStreak] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchMotivation = async (currentStreak: number) => {
        setLoading(true);

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Authentication Error', 'Please sign in again.');
            return;
        }

        try {
            const idToken = await user.getIdToken(); // 🔐 Secure backend call

            const prompt = `The user has maintained a spiritual practice streak for ${currentStreak} days. Respond as Jesus would — with love, encouragement, and a message that acknowledges their consistency and motivates them to keep going.`;

            const res = await fetch(ASK_GEMINI_FUNCTION, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ prompt })
            });

            const data = await res.json();
            const text = data.response || `I see your dedication. Each day, your light grows brighter. Keep walking with Me.`;

            setMessage(text);
        } catch (err) {
            console.error('❌ Streak fetch error:', err);
            Alert.alert('Error', 'Could not retrieve your message. Try again later.');
        } finally {
            setLoading(false);
        }
    };

    const loadStreak = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const data = snap.data();

        const currentStreak = data?.streak || 0;
        setStreak(currentStreak);
        fetchMotivation(currentStreak);
    };

    useEffect(() => {
        loadStreak();
    }, []);

    return (
        <ScreenContainer>
            <View style={styles.container}>
                <Text style={styles.title}>Your Streak</Text>
                {streak !== null && (
                    <Text style={styles.streak}>{streak} day{streak === 1 ? '' : 's'} strong</Text>
                )}
                {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                ) : (
                    <Text style={styles.message}>{message}</Text>
                )}
                <View style={styles.buttonWrap}>
                    <Button title="Refresh Message" onPress={() => streak !== null && fetchMotivation(streak)} />
                </View>
            </View>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.primary,
        marginBottom: 16
    },
    streak: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.accent,
        marginBottom: 16
    },
    message: {
        fontSize: 16,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 20
    },
    buttonWrap: {
        marginTop: 12
    }
});
