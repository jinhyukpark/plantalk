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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

type Mode = 'findId' | 'reset';

export default function ForgotAccountScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('findId');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const switchMode = (next: Mode) => {
    setMode(next);
    setResultMessage('');
    setErrorMessage('');
  };

  const handleFindId = async () => {
    setResultMessage('');
    setErrorMessage('');
    if (!isValidEmail) {
      setErrorMessage('올바른 이메일 주소를 입력해주세요');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiService.findId(email.trim());
      setResultMessage(res.message || '입력하신 이메일로 가입된 아이디가 있다면 메일을 보내드렸습니다');
    } catch (error: any) {
      setErrorMessage(error.message || '요청에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    setResultMessage('');
    setErrorMessage('');
    if (!nickname.trim()) {
      setErrorMessage('닉네임을 입력해주세요');
      return;
    }
    if (!isValidEmail) {
      setErrorMessage('올바른 이메일 주소를 입력해주세요');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiService.requestPasswordReset(nickname.trim(), email.trim());
      navigation.navigate('ResetPassword', { nickname: nickname.trim(), email: email.trim() });
    } catch (error: any) {
      setErrorMessage(error.message || '요청에 실패했습니다');
    } finally {
      setIsSubmitting(false);
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
          <Text style={styles.topBarTitle}>계정 찾기</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'findId' && styles.modeButtonActive]}
              onPress={() => mode !== 'findId' && switchMode('findId')}
            >
              <Text style={[styles.modeButtonText, mode === 'findId' && styles.modeButtonTextActive]}>
                아이디 찾기
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'reset' && styles.modeButtonActive]}
              onPress={() => mode !== 'reset' && switchMode('reset')}
            >
              <Text style={[styles.modeButtonText, mode === 'reset' && styles.modeButtonTextActive]}>
                비밀번호 재설정
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>
            {mode === 'findId' ? '아이디(닉네임) 찾기' : '비밀번호 재설정'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'findId'
              ? '가입 시 등록한 이메일 주소를 입력하면, 해당 이메일로 가입된 아이디를 메일로 보내드립니다.'
              : '아이디(닉네임)와 가입 시 등록한 이메일을 입력하면, 비밀번호 재설정 인증 코드를 메일로 보내드립니다.'}
          </Text>

          {mode === 'reset' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>닉네임</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.registeredNicknamePlaceholder')}
                placeholderTextColor={Colors.textMuted}
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                maxLength={20}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이메일</Text>
            <TextInput
              style={[
                styles.input,
                email.length > 0 && isValidEmail && styles.inputValid,
                email.length > 0 && !isValidEmail && styles.inputInvalid,
              ]}
              placeholder={t('auth.registeredEmailPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={254}
            />
          </View>

          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {resultMessage !== '' && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} style={{ marginRight: 6 }} />
              <Text style={styles.successText}>{resultMessage}</Text>
            </View>
          )}

          <Button
            title={
              isSubmitting
                ? '처리중...'
                : mode === 'findId'
                ? '아이디 찾기 메일 받기'
                : '인증 코드 받기'
            }
            onPress={mode === 'findId' ? handleFindId : handleRequestReset}
            variant="primary"
            size="large"
            disabled={isSubmitting}
            style={styles.submitButton}
            fullWidth
          />

          <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
            <Text style={styles.backLinkText}>로그인으로 돌아가기</Text>
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.textSecondary,
  },
  modeButtonTextActive: {
    color: Colors.text,
    fontWeight: FontWeights.bold,
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
  inputValid: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  inputInvalid: {
    borderColor: Colors.error,
    backgroundColor: '#FEF2F2',
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
  backLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
});
