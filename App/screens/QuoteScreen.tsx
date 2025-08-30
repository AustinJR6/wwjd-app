import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from "@/components/ui/Screen";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, 'Quote'>;

export default function QuoteScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        content: { flex: 1, justifyContent: 'center' },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // ✅ added missing 'center' style
        verse: {
          fontSize: 20,
          textAlign: 'center',
          marginBottom: 16,
          color: theme.colors.text,
        },
        quote: {
          fontSize: 20,
          textAlign: 'center',
          marginBottom: 16,
          color: theme.colors.text,
        }, // ✅ added missing 'quote' style
        reference: {
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 24,
          color: theme.colors.fadedText,
        },
        buttonWrap: { alignItems: 'center' },
      }),
    [theme],
  );
  const [quote, setQuote] = useState<{ text: string; reference: string }>({
    text: '',
    reference: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuote() {
      const refs = [
        'John 3:16',
        'Matthew 5:9',
        'Luke 6:31',
        'Mark 10:14',
        'John 13:34',
        'Matthew 11:28',
        'Luke 12:15',
      ];
      const randomRef = refs[Math.floor(Math.random() * refs.length)];

      try {
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(randomRef)}?translation=kjv`);
        const data = await res.json();
        setQuote({ text: data.text.trim(), reference: data.reference });
      } catch (err) {
        console.error('Error fetching verse:', err);
        setQuote({
          text: 'Love one another as I have loved you.',
          reference: 'John 13:34',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchQuote();
  }, []);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <CustomText style={styles.quote}>“{quote.text}”</CustomText>
        <CustomText style={styles.reference}>— {quote.reference}</CustomText>
        <View style={styles.buttonWrap}>
          <Button title="Continue" onPress={() => navigation.replace('MainTabs')} />
        </View>
      </View>
    </Screen>
  );
}


