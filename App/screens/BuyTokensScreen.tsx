import CustomText from '@/components/common/CustomText';
import React from 'react';
import { View,  StyleSheet, Alert, Linking } from 'react-native';
import Button from '@/components/common/Button';
import { useUser } from '@/hooks/useUser';
import { createStripeCheckout } from '@/services/apiService';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from "@/navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, 'BuyTokens'>;

export default function BuyTokensScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        content: {
          flex: 1,
          justifyContent: 'center',
        },
        title: {
          fontSize: 26,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 8,
          color: theme.colors.primary,
        },
        subtitle: {
          fontSize: 16,
          textAlign: 'center',
          color: theme.colors.text,
          marginBottom: 32,
        },
        pack: {
          marginBottom: 24,
          padding: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 10,
        },
        amount: {
          fontSize: 18,
          marginBottom: 8,
          textAlign: 'center',
          color: theme.colors.text,
        },
        price: {
          color: theme.colors.accent,
          fontWeight: '600',
        },
        buttonWrap: {
          marginTop: 32,
          alignItems: 'center',
        },
      }),
    [theme],
  );
  const { user } = useUser();
  const purchase = async (amount: number) => {
    if (!user) return;
    try {
      const url = await createStripeCheckout(user.uid, {
        type: 'one-time',
        amount,
      });
      if (url) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to start purchase.');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      Alert.alert('Error', 'Unable to start purchase.');
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <CustomText style={styles.title}>Buy Grace Tokens</CustomText>
        <CustomText style={styles.subtitle}>Use tokens for extra asks and confessions</CustomText>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            5 Tokens — <CustomText style={styles.price}>$1.99</CustomText>
          </CustomText>
          <Button title="Buy 5 Tokens" onPress={() => purchase(5)} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            15 Tokens — <CustomText style={styles.price}>$4.99</CustomText>
          </CustomText>
          <Button title="Buy 15 Tokens" onPress={() => purchase(15)} />
        </View>

        <View style={styles.pack}>
          <CustomText style={styles.amount}>
            40 Tokens — <CustomText style={styles.price}>$9.99</CustomText>
          </CustomText>
          <Button title="Buy 40 Tokens" onPress={() => purchase(40)} />
        </View>

        <View style={styles.buttonWrap}>
          <Button title="Back to Home" onPress={() => navigation.navigate('Home')} />
        </View>
      </View>
    </ScreenContainer>
  );
}


