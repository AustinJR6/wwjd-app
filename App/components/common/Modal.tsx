import React from 'react'
import { Modal as RNModal, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { theme } from '../theme/theme'

interface ModalProps {
  visible: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ visible, title, onClose, children }: ModalProps) {
  return (
    <RNModal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {title && <Text style={styles.title}>{title}</Text>}
          <View style={styles.content}>{children}</View>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    width: '85%',
    backgroundColor: theme.colors.card,
    borderRadius: 15,
    padding: 20,
    elevation: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text
  },
  content: {
    marginBottom: 20
  },
  close: {
    alignSelf: 'flex-end'
  },
  closeText: {
    color: theme.colors.primary,
    fontWeight: '600'
  }
})
