import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../components/Button';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const { nickname = '', email = '' } = route.params || {};

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleConfirm = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (code.trim().length !== 6) {
      setErrorMessage('6자리 인증 코드를 입력해주세요');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMessage('비밀번호는 4자 이상이어야 합니다');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('비밀번호가 일치하지 않습니다');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiService.confirmPasswordReset(nickname, email, code.trim(), newPassword);
      Alert.alert('완료', '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.', [
        { text: '확인', onPress: () => navigation.navigate('Onboarding') },
      ]);
    } catch (error: any) {
      setErrorMessage(error.message || '비밀번호 재설정에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setIsResending(true);
    try {
      await apiService.requestPasswordReset(nickname, email);
      setInfoMessage('인증 코드를 다시 보내드렸습니다. 메일함을 확인해주세요.');
    } catch (error: any) {
      setErrorMessage(error.message || '재전송에 실패했습니다');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>비밀번호 재설정</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>인증 코드 입력</Text>
          <Text style={styles.subtitle}>
            {email
              ? `${email} 주소로 보내드린 6자리 인증 코드와 새 비밀번호를 입력해주세요.`
              : '메일로 보내드린 6자리 인증 코드와 새 비밀번호를 입력해주세요.'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>인증 코드</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder={t('auth.verificationCodePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>새 비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.newPasswordPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>새 비밀번호 확인</Text>
            <TextInput
              style={[
                styles.input,
                confirmPassword.length > 0 && passwordsMatch && styles.inputValid,
                confirmPassword.length > 0 && !passwordsMatch && styles.inputInvalid,
              ]}
              placeholder={t('auth.confirmNewPasswordPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.validationError}>비밀번호가 일치하지 않습니다</Text>
            )}
          </View>

          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {infoMessage !== '' && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={{ marginRight: 6 }} />
              <Text style={styles.successText}>{infoMessage}</Text>
            </View>
          )}

          <Button
            title={isSubmitting ? '처리중...' : '비밀번호 변경'}
            onPress={handleConfirm}
            variant="primary"
            size="large"
            disabled={isSubmitting}
            style={styles.submitButton}
            fullWidth
          />

          <TouchableOpacity
            style={styles.resendLink}
            onPress={handleResend}
            disabled={isResending}
          >
            <Text style={styles.resendLinkText}>
              {isResending ? '재전송 중...' : '인증 코드 재전송'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeInput: {
    letterSpacing: 8,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  inputValid: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  inputInvalid: {
    borderColor: Colors.error,
    backgroundColor: '#FEF2F2',
  },
  validationError: {
    marginTop: Spacing.xs,
    marginLeft: 4,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSizes.sm,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  successText: {
    flex: 1,
    color: Colors.success,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  resendLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  resendLinkText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
});
