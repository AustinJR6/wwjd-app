import React from 'react'
import CustomText from '@/components/common/CustomText';
import { Modal as RNModal, View, StyleSheet, TouchableOpacity } from 'react-native'
import { useTheme } from "@/components/theme/theme"

interface ModalProps {
  visible: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ visible, title, onClose, children }: ModalProps) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        container: {
          width: '85%',
          backgroundColor: theme.colors.card,
          borderRadius: 15,
          padding: 20,
          elevation: 10,
        },
        title: {
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 10,
          color: theme.colors.text,
        },
        content: {
          marginBottom: 20,
        },
        close: {
          alignSelf: 'flex-end',
        },
        closeText: {
          color: theme.colors.primary,
          fontWeight: '600',
        },
      }),
    [theme],
  );
  return (
    <RNModal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {title && <CustomText style={styles.title}>{title}</CustomText>}
          <View style={styles.content}>{children}</View>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <CustomText style={styles.closeText}>Close</CustomText>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  )
}


