import CustomText from '@/components/common/CustomText';
import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { useTheme } from '@/components/theme/theme';

interface TextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  label?: string;
}

export default function TextField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  label,
}: TextFieldProps) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrapper: { marginVertical: 10 },
        label: {
          color: theme.colors.text,
          marginBottom: 5,
          fontWeight: '600',
        },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 12,
          padding: 12,
          color: theme.colors.text,
          backgroundColor: theme.colors.inputBackground,
        },
      }),
    [theme],
  );
  return (
    <View style={styles.wrapper}>
      {label && <CustomText style={styles.label}>{label}</CustomText>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.gray}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}
// styles created inside the component so they update with theme
