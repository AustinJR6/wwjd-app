import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    ActivityIndicator,
    StyleSheet,
    Alert,
    ScrollView
} from 'react-native';
import { auth } from '../firebaseConfig';
import ScreenContainer from '../components/theme/ScreenContainer';
import { theme } from '../components/theme/theme';
import { ASK_GEMINI_FUNCTION } from '../utils/constants';

export default function ConfessionalScreen() {
    const [confession, setConfession] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!confession.trim()) {
            Alert.alert('Please enter a confession or concern.');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Authentication Error', 'Please sign in again.');
            return;
        }

        setLoading(true);

        try {
            const idToken = await user.getIdToken(); // 🔐 Secure token

            const prompt = `The user confesses: "${confession}". Respond as Jesus would — with gentle understanding, healing wisdom, and an invitation to grow.`;

            const res = await fetch(ASK_GEMINI_FUNCTION, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ prompt })
            });

            const data = await res.json();
            const reply = data.response || 'My child, your heart is seen. I walk with you always.';

            setResponse(reply);
        } catch (err) {
            console.error('❌ Confessional error:', err);
            Alert.alert('Error', 'Could not process your confession. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenContainer>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Confess and Reflect</Text>
                <TextInput
                    style={styles.input}
                    placeholder="What's weighing on your heart?"
                    value={confession}
                    onChangeText={setConfession}
                    multiline
                />
                <Button title="Submit" onPress={handleSubmit} disabled={loading} />
                {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
                {!!response && (
                    <View style={styles.responseContainer}>
                        <Text style={styles.responseLabel}>Response:</Text>
                        <Text style={styles.responseText}>{response}</Text>
                    </View>
                )}
            </ScrollView>
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
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        width: '100%',
        minHeight: 120,
        textAlignVertical: 'top',
        backgroundColor: '#fff',
        marginBottom: 16
    },
    responseContainer: {
        marginTop: 20,
        backgroundColor: '#f0f4f8',
        padding: 16,
        borderRadius: 8,
        width: '100%'
    },
    responseLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.accent,
        marginBottom: 6
    },
    responseText: {
        fontSize: 16,
        color: theme.colors.text
    }
});

