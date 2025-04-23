import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    ActivityIndicator,
    Alert
} from 'react-native';
import { auth } from '../firebaseConfig';
import ScreenContainer from '../components/theme/ScreenContainer';
import { theme } from '../components/theme/theme';
import { ASK_GEMINI_FUNCTION } from '../utils/constants';

export default function ChallengeScreen() {
    const [challenge, setChallenge] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchChallenge = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Authentication Error', 'Please sign in again.');
            return;
        }

        setLoading(true);

        try {
            const idToken = await user.getIdToken(); // 🔐 Secure the call

            const prompt = "Give me a short but meaningful spiritual challenge for today. Keep it uplifting, specific, and rooted in wisdom.";

            const response = await fetch(ASK_GEMINI_FUNCTION, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            const text = data.response || 'Reflect on your purpose today, and take one step closer to it.';
            setChallenge(text);
        } catch (err) {
            console.error('❌ Challenge fetch error:', err);
            Alert.alert('Error', 'Unable to fetch your challenge. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChallenge();
    }, []);

    return (
        <ScreenContainer>
            <View style={styles.container}>
                <Text style={styles.title}>Daily Challenge</Text>
                {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                ) : (
                    <Text style={styles.challenge}>{challenge}</Text>
                )}
                <View style={styles.buttonWrap}>
                    <Button title="Refresh Challenge" onPress={fetchChallenge} />
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
    challenge: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        color: theme.colors.text
    },
    buttonWrap: {
        marginTop: 16
    }
});
