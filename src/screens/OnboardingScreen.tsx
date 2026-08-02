import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { NATIONALITIES } from '../i18n/translations';

export function OnboardingScreen() {
  const { signUp, login, completeOnboarding } = useApp();
  const navigation = useNavigation<any>();
  const { t, nationality, language, setPreviewNationality } = useLanguage();
  const bottomPadding = Spacing.lg;
  const [step, setStep] = useState<'intro' | 'auth'>('auth');
  const [mode, setMode] = useState<'signup' | 'login'>('login');
  const [agreed, setAgreed] = useState(false);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [age, setAge] = useState(25);
  const [ageInput, setAgeInput] = useState('25');
  const ageTrackWidthRef = useRef(1);
  const ageTrackPageXRef = useRef(0);
  const ageTrackRef = useRef<View>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'available' | 'taken'>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [usageGuide, setUsageGuide] = useState(t('profile.usageGuideDefault'));

  const agePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / ageTrackWidthRef.current));
      const selectedAge = Math.round(18 + ratio * 82);
      setAge(selectedAge);
      setAgeInput(String(selectedAge));
      ageTrackRef.current?.measureInWindow((x) => {
        ageTrackPageXRef.current = x;
      });
    },
    onPanResponderMove: (_, gesture) => {
      const localX = gesture.moveX - ageTrackPageXRef.current;
      const ratio = Math.min(1, Math.max(0, localX / ageTrackWidthRef.current));
      const selectedAge = Math.round(18 + ratio * 82);
      setAge(selectedAge);
      setAgeInput(String(selectedAge));
    },
  })).current;

  useEffect(() => {
    let active = true;
    setUsageGuide(t('profile.usageGuideDefault'));
    apiService.getUsageGuide(language)
      .then(content => {
        if (active && content?.trim()) setUsageGuide(content);
      })
      .catch(() => {
        // 최초 실행 중 서버가 일시적으로 연결되지 않으면 내장 번역문을 사용합니다.
      });
    return () => {
      active = false;
    };
  }, [language, t]);

  useEffect(() => {
    if (mode === 'login') {
      setNicknameStatus('idle');
      setValidationMessage('');
      return;
    }

    if (nickname.trim().length < 2) {
      setNicknameStatus('idle');
      setValidationMessage('');
      return;
    }

    const debounce = setTimeout(async () => {
      setIsChecking(true);
      try {
        const available = await apiService.checkNicknameAvailable(nickname.trim());
        setNicknameStatus(available ? 'available' : 'taken');
        setValidationMessage(available ? '사용 가능한 닉네임입니다' : '이미 사용중인 닉네임입니다');
      } catch (error) {
        setNicknameStatus('idle');
        setValidationMessage('');
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [nickname, mode]);

  const handleContinue = async () => {
    if (step === 'intro' && agreed) {
      setMode('signup');
      setStep('auth');
    }
  };

  const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const commitAgeInput = () => {
    const parsed = Number(ageInput);
    const normalizedAge = Number.isFinite(parsed)
      ? Math.min(100, Math.max(18, parsed))
      : 18;
    setAge(normalizedAge);
    setAgeInput(String(normalizedAge));
    return normalizedAge;
  };

  const handleSubmit = async () => {
    setAuthError('');
    if (mode === 'signup') {
      if (nicknameStatus !== 'available') {
        setAuthError('사용 가능한 닉네임을 입력해주세요');
        return;
      }
      if (!isValidEmail) {
        setAuthError('올바른 이메일 주소를 입력해주세요');
        return;
      }
      if (password.length < 4) {
        setAuthError('비밀번호는 4자 이상이어야 합니다');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('비밀번호가 일치하지 않습니다');
        return;
      }

      setIsSubmitting(true);
      try {
        if (!gender) {
          setAuthError(t('auth.genderRequired'));
          return;
        }
        const submittedAge = commitAgeInput();
        await signUp(nickname.trim(), password, email.trim(), nationality, gender, submittedAge);
        completeOnboarding();
      } catch (error: any) {
        setAuthError(error.message || '회원가입에 실패했습니다');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!nickname.trim()) {
        setAuthError('닉네임을 입력해주세요');
        return;
      }
      if (!password) {
        setAuthError('비밀번호를 입력해주세요');
        return;
      }

      setIsSubmitting(true);
      try {
        await login(nickname.trim(), password);
        completeOnboarding();
      } catch (error: any) {
        setAuthError(error.message || '로그인에 실패했습니다');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetAuthForm = () => {
    setNickname('');
    setPassword('');
    setEmail('');
    setGender(null);
    setAge(25);
    setAgeInput('25');
    setConfirmPassword('');
    setNicknameStatus('idle');
    setValidationMessage('');
    setAuthError('');
  };

  const startSignUp = () => {
    resetAuthForm();
    setAgreed(false);
    setMode('signup');
    setStep('intro');
  };

  const returnToLogin = () => {
    resetAuthForm();
    setAgreed(false);
    setMode('login');
    setStep('auth');
  };

  const enteredAge = Number(ageInput);
  const isAgeInputValid = ageInput !== '' && Number.isFinite(enteredAge)
    && enteredAge >= 18 && enteredAge <= 100;

  const isSignUpValid = mode === 'signup' && 
    nicknameStatus === 'available' && 
    isValidEmail &&
    gender !== null && isAgeInputValid &&
    password.length >= 4 && 
    password === confirmPassword;

  const isLoginValid = mode === 'login' && 
    nickname.trim().length >= 2 && 
    password.length >= 1;

  const isLoginScreen = step === 'auth' && mode === 'login';
  const isStyledAuthScreen = step === 'auth';

  return (
    <SafeAreaView style={[styles.container, isStyledAuthScreen && styles.loginContainer]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.keyboardView, isStyledAuthScreen && styles.loginContainer]}
      >
        <ScrollView 
          style={isStyledAuthScreen ? styles.loginScrollView : undefined}
          contentContainerStyle={[styles.content, isStyledAuthScreen && styles.loginContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, isStyledAuthScreen && styles.loginHero, isLoginScreen && styles.compactLoginHero]}>
            {isStyledAuthScreen && (
              <>
                <View style={[styles.heroDecoration, styles.heroDecorationLeft]} />
                <View style={[styles.heroDecoration, styles.heroDecorationRight]} />
              </>
            )}
            <View style={isStyledAuthScreen ? [styles.loginLogoStage, isLoginScreen && styles.compactLoginLogoStage] : undefined}>
              <Image
                source={require('../../assets/images/logo-friends.png')}
                style={[styles.logoImage, isStyledAuthScreen && styles.loginLogoImage, isLoginScreen && styles.compactLoginLogoImage]}
              />
            </View>
            <Text style={[styles.title, isStyledAuthScreen && styles.loginBrandTitle, isLoginScreen && styles.compactLoginBrandTitle]}>PlanTalk</Text>
            <Text style={[styles.subtitle, isStyledAuthScreen && styles.loginHeroTitle, isLoginScreen && styles.compactLoginHeroTitle]}>
              {isStyledAuthScreen
                ? t(isLoginScreen ? 'auth.loginHeroTitle' : 'auth.signupHeroTitle')
                : t('onboarding.welcome')}
            </Text>
            {isStyledAuthScreen && !isLoginScreen && (
              <>
                <Text style={styles.loginHeroSubtitle}>
                  {t(isLoginScreen ? 'auth.loginHeroSubtitle' : 'auth.signupHeroSubtitle')}
                </Text>
                <View style={styles.promiseTypes}>
                  <View style={styles.promiseType}>
                    <Ionicons name="people-outline" size={16} color={Colors.primary} />
                    <Text style={styles.promiseTypeText}>{t('auth.loginFriends')}</Text>
                  </View>
                  <View style={styles.promiseType}>
                    <Ionicons name="heart-outline" size={16} color="#F06A8A" />
                    <Text style={styles.promiseTypeText}>{t('auth.loginCouple')}</Text>
                  </View>
                  <View style={styles.promiseType}>
                    <Ionicons name="checkmark-done-outline" size={16} color="#2E9B7B" />
                    <Text style={styles.promiseTypeText}>{t('auth.loginTogether')}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {step === 'intro' ? (
            <>
              <View style={styles.introSection}>
                <Text style={styles.introTitle}>{t('onboarding.record')}</Text>
                <Text style={styles.introText}>
                  {t('onboarding.description')}
                </Text>
              </View>

              <View style={styles.featureGrid}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: Colors.secondary }]}>
                    <Text style={styles.featureEmoji}>💕</Text>
                  </View>
                  <Text style={styles.featureLabel}>{t('onboarding.romance')}</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: Colors.accentLight }]}>
                    <Text style={styles.featureEmoji}>🎉</Text>
                  </View>
                  <Text style={styles.featureLabel}>{t('onboarding.gathering')}</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: Colors.secondary }]}>
                    <Text style={styles.featureEmoji}>📢</Text>
                  </View>
                  <Text style={styles.featureLabel}>{t('onboarding.rally')}</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: Colors.accentLight }]}>
                    <Text style={styles.featureEmoji}>🤝</Text>
                  </View>
                  <Text style={styles.featureLabel}>{t('onboarding.promise')}</Text>
                </View>
              </View>

              <Card style={styles.disclaimerCard} variant="outlined">
                <View style={styles.disclaimerHeader}>
                  <Ionicons name="information-circle" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.disclaimerTitle}>{t('onboarding.guide')}</Text>
                </View>
                <Text style={styles.disclaimerText}>
                  {usageGuide}
                </Text>
              </Card>

              <TouchableOpacity 
                style={styles.checkboxRow}
                onPress={() => setAgreed(!agreed)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  {t('onboarding.ageConsent')}
                </Text>
              </TouchableOpacity>

              <Button
                title={t('onboarding.start')}
                onPress={handleContinue}
                variant="primary"
                size="large"
                disabled={!agreed}
                style={styles.continueButton}
                fullWidth
              />
              <TouchableOpacity style={styles.forgotLink} onPress={returnToLogin}>
                <Text style={styles.forgotLinkText}>로그인으로 돌아가기</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.authSection, isStyledAuthScreen && styles.loginAuthSection, isStyledAuthScreen && styles.compactLoginSection]}>
                <Text style={[styles.authTitle, isStyledAuthScreen && styles.compactAuthTitle]}>
                  {mode === 'signup' ? t('auth.create') : t('auth.welcomeBack')}
                </Text>
                <Text style={[styles.authSubtitle, isStyledAuthScreen && styles.compactAuthSubtitle]}>
                  {mode === 'signup' 
                    ? t('auth.signupHint')
                    : t('auth.loginHint')}
                </Text>

                {mode === 'login' && (
                  <View style={[styles.inputGroup, styles.compactInputGroup]}>
                    <Text style={styles.inputLabel}>{t('auth.nationality')}</Text>
                    <View style={styles.loginNationalityRow}>
                      {NATIONALITIES.map(item => (
                        <TouchableOpacity
                          key={item.code}
                          style={[
                            styles.loginNationalityButton,
                            styles.compactNationalityButton,
                            nationality === item.code && styles.nationalityButtonActive,
                          ]}
                          onPress={() => setPreviewNationality(item.code)}
                        >
                          <Text style={[styles.loginNationalityFlag, styles.compactNationalityFlag]}>{item.flag}</Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.loginNationalityText,
                              nationality === item.code && styles.nationalityTextActive,
                            ]}
                          >
                            {item.code === 'KR' ? '한국어' : item.code === 'JP' ? '日本語' : 'English'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={[styles.inputGroup, isStyledAuthScreen && styles.compactInputGroup]}>
                  <Text style={styles.inputLabel}>{t('auth.nickname')}</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        isStyledAuthScreen && styles.compactInput,
                        mode === 'signup' && nicknameStatus === 'available' && styles.inputValid,
                        mode === 'signup' && nicknameStatus === 'taken' && styles.inputInvalid,
                      ]}
                      placeholder={t('auth.nicknamePlaceholder')}
                      placeholderTextColor={Colors.textMuted}
                      value={nickname}
                      onChangeText={setNickname}
                      autoCapitalize="none"
                      maxLength={20}
                    />
                    {mode === 'signup' && isChecking && (
                      <View style={styles.inputIcon}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                      </View>
                    )}
                    {mode === 'signup' && !isChecking && nicknameStatus === 'available' && (
                      <View style={styles.inputIcon}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                      </View>
                    )}
                    {mode === 'signup' && !isChecking && nicknameStatus === 'taken' && (
                      <View style={styles.inputIcon}>
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                      </View>
                    )}
                  </View>
                  {mode === 'signup' && validationMessage !== '' && (
                    <Text style={[
                      styles.validationMessage,
                      nicknameStatus === 'available' && styles.validationSuccess,
                      nicknameStatus === 'taken' && styles.validationError,
                    ]}>
                      {validationMessage}
                    </Text>
                  )}
                </View>

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('auth.gender')}</Text>
                    <View style={styles.genderRow}>
                      {(['MALE', 'FEMALE'] as const).map(value => (
                        <TouchableOpacity
                          key={value}
                          style={[styles.genderButton, gender === value && styles.genderButtonActive]}
                          onPress={() => setGender(value)}
                        >
                          <Ionicons name={value === 'MALE' ? 'male' : 'female'} size={20} color={gender === value ? Colors.primary : Colors.textLight} />
                          <Text style={[styles.genderText, gender === value && styles.genderTextActive]}>
                            {t(value === 'MALE' ? 'auth.male' : 'auth.female')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <View style={styles.ageLabelRow}>
                      <Text style={styles.inputLabel}>{t('auth.age')}</Text>
                      <View style={styles.ageInputWrap}>
                        <TextInput
                          style={styles.ageInput}
                          value={ageInput}
                          onChangeText={(value) => {
                            setAgeInput(value.replace(/\D/g, ''));
                          }}
                          onBlur={commitAgeInput}
                          keyboardType="number-pad"
                          maxLength={3}
                        />
                        <Text style={styles.ageUnit}>{t('auth.ageUnit')}</Text>
                      </View>
                    </View>
                    <View
                      ref={ageTrackRef}
                      style={styles.ageTrack}
                      onLayout={(event) => {
                        const width = event.nativeEvent.layout.width;
                        ageTrackWidthRef.current = width;
                        ageTrackRef.current?.measureInWindow((x) => {
                          ageTrackPageXRef.current = x;
                        });
                      }}
                      accessibilityRole="adjustable"
                      accessibilityLabel={t('auth.age')}
                      accessibilityValue={{ min: 18, max: 100, now: age }}
                      {...agePanResponder.panHandlers}
                    >
                      <View style={[styles.ageFill, { width: `${((age - 18) / 82) * 100}%` }]} />
                      <View style={[styles.ageThumb, { left: `${((age - 18) / 82) * 100}%` }]} />
                    </View>
                    <View style={styles.ageRangeLabels}><Text style={styles.ageRangeText}>18</Text><Text style={styles.ageRangeText}>100</Text></View>
                    <Text style={styles.emailHint}>{t('auth.ageHint')}</Text>
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('auth.nationality')}</Text>
                    <View style={styles.loginNationalityRow}>
                      {NATIONALITIES.map(item => (
                        <TouchableOpacity
                          key={item.code}
                          style={[
                            styles.loginNationalityButton,
                            styles.compactNationalityButton,
                            nationality === item.code && styles.nationalityButtonActive,
                          ]}
                          onPress={() => setPreviewNationality(item.code)}
                        >
                          <Text style={[styles.loginNationalityFlag, styles.compactNationalityFlag]}>{item.flag}</Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.loginNationalityText, nationality === item.code && styles.nationalityTextActive]}
                          >
                            {item.code === 'KR' ? '한국어' : item.code === 'JP' ? '日本語' : 'English'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.emailHint}>{t('auth.nationalityHint')}</Text>
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                    <TextInput
                      style={[
                        styles.input,
                        email.length > 0 && isValidEmail && styles.inputValid,
                        email.length > 0 && !isValidEmail && styles.inputInvalid,
                      ]}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={Colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      maxLength={254}
                    />
                    {email.length > 0 && !isValidEmail && (
                      <Text style={[styles.validationMessage, styles.validationError]}>
                        올바른 이메일 주소를 입력해주세요
                      </Text>
                    )}
                    <Text style={styles.emailHint}>
                      비밀번호를 잊으면 이 이메일로 계정을 찾을 수 있어요
                    </Text>
                  </View>
                )}

                <View style={[styles.inputGroup, isStyledAuthScreen && styles.compactInputGroup]}>
                  <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                  <TextInput
                    style={[styles.input, isStyledAuthScreen && styles.compactInput]}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('auth.confirmPassword')}</Text>
                    <TextInput
                      style={[
                        styles.input,
                        confirmPassword.length > 0 && password === confirmPassword && styles.inputValid,
                        confirmPassword.length > 0 && password !== confirmPassword && styles.inputInvalid,
                      ]}
                      placeholder={t('auth.confirmPasswordPlaceholder')}
                      placeholderTextColor={Colors.textMuted}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <Text style={[styles.validationMessage, styles.validationError]}>
                        비밀번호가 일치하지 않습니다
                      </Text>
                    )}
                  </View>
                )}

                {authError !== '' && (
                  <View style={styles.authErrorBox}>
                    <Ionicons name="alert-circle" size={18} color={Colors.error} style={{ marginRight: 6 }} />
                    <Text style={styles.authErrorText}>{authError}</Text>
                  </View>
                )}

                {mode === 'login' ? (
                  <Button
                    title={isSubmitting ? t('auth.processing') : t('auth.login')}
                    onPress={handleSubmit}
                    variant="primary"
                    size="large"
                    disabled={isSubmitting || !isLoginValid}
                    style={styles.compactLoginButton}
                    fullWidth
                  />
                ) : (
                  <Button
                    title={isSubmitting ? t('auth.processing') : t('auth.submit')}
                    onPress={handleSubmit}
                    variant="primary"
                    size="large"
                    disabled={isSubmitting || !isSignUpValid}
                    style={styles.compactLoginButton}
                    fullWidth
                  />
                )}
              </View>

              {mode === 'login' && (
                <View style={styles.loginLinks}>
                  <TouchableOpacity
                    style={[styles.forgotLink, styles.compactForgotLink]}
                    onPress={() => navigation.navigate('ForgotAccount')}
                  >
                    <Text style={styles.forgotLinkText}>{t('auth.forgot')}</Text>
                  </TouchableOpacity>
                  <View style={[styles.signupPrompt, styles.compactSignupPrompt]}>
                    <Text style={styles.signupPromptText}>아직 계정이 없으신가요?</Text>
                    <TouchableOpacity onPress={startSignUp} hitSlop={8}>
                      <Text style={styles.signupLinkText}>{t('auth.signup')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {mode === 'signup' && (
                <TouchableOpacity style={styles.forgotLink} onPress={returnToLogin}>
                  <Text style={styles.forgotLinkText}>로그인으로 돌아가기</Text>
                </TouchableOpacity>
              )}
            </>
          )}
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
  loginContainer: {
    backgroundColor: '#F7F5FF',
  },
  loginScrollView: {
    flex: 1,
    backgroundColor: '#F7F5FF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  loginContent: {
    paddingTop: Spacing.lg,
    paddingHorizontal: 0,
    backgroundColor: '#F7F5FF',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  loginHero: {
    overflow: 'hidden',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  compactLoginHero: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
  },
  heroDecoration: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEE9FF',
  },
  heroDecorationLeft: {
    left: -72,
    top: 28,
  },
  heroDecorationRight: {
    right: -82,
    top: 108,
    backgroundColor: '#FFEAF0',
  },
  loginLogoStage: {
    width: 104,
    height: 104,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.md,
    shadowColor: '#6E4BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  compactLoginLogoStage: {
    width: 72,
    height: 72,
    borderRadius: 23,
    marginBottom: Spacing.sm,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 24,
    marginBottom: Spacing.md,
  },
  loginLogoImage: {
    width: 88,
    height: 88,
    borderRadius: 26,
    marginBottom: 0,
  },
  compactLoginLogoImage: {
    width: 62,
    height: 62,
    borderRadius: 19,
  },
  title: {
    fontSize: 32,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  loginBrandTitle: {
    fontSize: 34,
    letterSpacing: -1,
  },
  compactLoginBrandTitle: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  loginHeroTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.lg,
    lineHeight: 26,
    textAlign: 'center',
    color: Colors.text,
    fontWeight: FontWeights.bold,
  },
  compactLoginHeroTitle: {
    marginTop: 3,
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  loginHeroSubtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  promiseTypes: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  promiseType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E9E4FA',
  },
  promiseTypeText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  introSection: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  introText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  featureGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  featureItem: {
    alignItems: 'center',
    width: '22%',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: FontWeights.bold,
  },
  disclaimerCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.background,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  disclaimerTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text,
  },
  disclaimerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  continueButton: {
    marginTop: Spacing.md,
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
  authSection: {
    marginBottom: Spacing.lg,
  },
  loginAuthSection: {
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: 0,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE8F8',
    shadowColor: '#37266B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
  },
  compactLoginSection: {
    padding: Spacing.md,
    borderRadius: 22,
  },
  compactAuthTitle: {
    fontSize: FontSizes.xl,
    marginBottom: 2,
  },
  compactAuthSubtitle: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
  },
  authTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  authSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  compactInputGroup: {
    marginBottom: Spacing.sm,
  },
  nationalityRow: {
    gap: Spacing.sm,
  },
  loginNationalityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  loginNationalityButton: {
    flex: 1,
    minWidth: 0,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
  },
  compactNationalityButton: {
    height: 40,
    flexDirection: 'row',
    gap: 5,
    borderRadius: BorderRadius.md,
  },
  loginNationalityFlag: {
    fontSize: 22,
    marginBottom: 2,
  },
  compactNationalityFlag: {
    fontSize: 18,
    marginBottom: 0,
  },
  loginNationalityText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderButton: { flex: 1, height: 44, borderRadius: BorderRadius.md, backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  genderButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.secondary },
  genderText: { color: Colors.textLight, fontSize: FontSizes.md, fontWeight: FontWeights.medium },
  genderTextActive: { color: Colors.primary, fontWeight: FontWeights.bold },
  ageLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  ageInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 8 },
  ageInput: { width: 38, height: 34, color: Colors.text, fontSize: FontSizes.md, fontWeight: FontWeights.bold, textAlign: 'center', padding: 0 },
  ageUnit: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  ageTrack: { height: 36, justifyContent: 'center', marginHorizontal: 8 },
  ageFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  ageThumb: { position: 'absolute', marginLeft: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  ageRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 4 },
  ageRangeText: { color: Colors.textMuted, fontSize: 11 },
  nationalityButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
  },
  nationalityButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.secondary,
  },
  nationalityFlag: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  nationalityText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  nationalityTextActive: {
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.background,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compactInput: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  inputValid: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  inputInvalid: {
    borderColor: Colors.error,
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  validationMessage: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
    marginLeft: 4,
  },
  validationSuccess: {
    color: Colors.success,
  },
  validationError: {
    color: Colors.error,
  },
  emailHint: {
    marginTop: Spacing.xs,
    marginLeft: 4,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  authErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  authErrorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSizes.sm,
  },
  forgotLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  compactForgotLink: {
    marginTop: Spacing.md,
  },
  forgotLinkText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  loginLinks: {
    alignItems: 'center',
  },
  signupPrompt: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  compactSignupPrompt: {
    marginTop: Spacing.md,
  },
  compactLoginButton: {
    marginTop: Spacing.xs,
  },
  authHorizontalMargin: {
    marginHorizontal: Spacing.lg,
  },
  signupSubmitButton: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  signupPromptText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  signupLinkText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.bold,
  },
});
