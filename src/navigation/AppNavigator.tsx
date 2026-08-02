import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import ForgotAccountScreen from '../screens/ForgotAccountScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CreateAgreementScreen } from '../screens/CreateAgreementScreen';
import { AgreementDetailScreen } from '../screens/AgreementDetailScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import PublicRoomsScreen from '../screens/PublicRoomsScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import NotificationScreen from '../screens/NotificationScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { DiscoverFriendsScreen } from '../screens/DiscoverFriendsScreen';
import { DirectMessageScreen } from '../screens/DirectMessageScreen';
import GlobalNotificationToast from '../components/GlobalNotificationToast';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeOverview" component={HomeScreen} />
      <HomeStack.Screen
        name="HomeHistory"
        component={CalendarScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </HomeStack.Navigator>
  );
}

function FriendsDiscoverTabScreen() {
  return <DiscoverFriendsScreen embedded />;
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileOverview" component={ProfileScreen} />
      <ProfileStack.Screen
        name="ProfileFriends"
        component={FriendsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const tabBarHeight = 64;
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: 'transparent',
          height: tabBarHeight + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding + 4,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Friends"
        component={FriendsDiscoverTabScreen}
        options={{
          tabBarLabel: t('tabs.friends'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PublicRooms"
        component={PublicRoomsScreen}
        options={{
          tabBarLabel: t('tabs.rooms'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'planet' : 'planet-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: t('tabs.home'),
          popToTopOnBlur: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: t('tabs.profile'),
          popToTopOnBlur: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isOnboarded, isSessionRestoring, user } = useApp();

  if (isSessionRestoring) {
    return <View style={styles.sessionLoading} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}
      >
        {!isOnboarded || !user ? (
          <>
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotAccount"
              component={ForgotAccountScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateAgreement"
              component={CreateAgreementScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="AgreementDetail"
              component={AgreementDetailScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="CreateRoom"
              component={CreateRoomScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="RoomDetail"
              component={RoomDetailScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="DirectMessage"
              component={DirectMessageScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DiscoverFriends"
              component={DiscoverFriendsScreen}
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
      <GlobalNotificationToast />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  sessionLoading: {
    flex: 1,
    backgroundColor: '#F8F6FF',
  },
});
