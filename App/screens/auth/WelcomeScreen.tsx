import React, { useEffect, useRef } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/common/Button';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useTheme } from '@/components/theme/theme';
import { resetToLogin } from '@/navigation/navigationRef';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
        },
        logo: {
          width: 200,
          height: 200,
          alignSelf: 'center',
          marginBottom: 24,
        },
        buttons: {
          width: '80%',
          alignSelf: 'center',
        },
        buttonWrap: {
          marginVertical: 8,
        },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: 24,
        },
        loginLink: {
          textAlign: 'center',
          marginBottom: 12,
          color: theme.colors.primary,
          textDecorationLine: 'underline',
        },
      }),
    [theme],
  );

  return (
    <LinearGradient colors={[theme.colors.primary, theme.colors.surface]} style={styles.container}>
      <CustomText style={styles.loginLink} onPress={resetToLogin}>
        Already have an account? Go to Login
      </CustomText>
      {/* Image removed if asset missing to prevent crash */}
      <CustomText style={styles.title}>Welcome to OneVine</CustomText>
      <View style={styles.buttons}>
        <View style={styles.buttonWrap}>
          <Button title="Log In" onPress={resetToLogin} />
        </View>
        <View style={styles.buttonWrap}>
          <Button title="Sign Up" onPress={() => navigation.navigate('Signup')} />
        </View>
        <View style={styles.buttonWrap}>
          <Button title="Forgot Password" onPress={() => navigation.navigate('ForgotPassword')} />
        </View>
        <View style={styles.buttonWrap}>
          <Button title="Forgot Username" onPress={() => navigation.navigate('ForgotUsername')} />
        </View>
      </View>
    </LinearGradient>
  );
}


