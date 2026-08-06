import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';

import WelcomeScreen  from '../screens/auth/WelcomeScreen';
import LoginScreen    from '../screens/auth/LoginScreen';
import SignUpScreen   from '../screens/auth/SignUpScreen';
import RescuerVerificationScreen from '../screens/auth/RescuerVerificationScreen';

import SOSScreen      from '../screens/Citizen/SOSScreen';
import StatusScreen   from '../screens/Citizen/StatusScreen';
import LogScreen      from '../screens/Citizen/LogScreen';
import SettingsScreen from '../screens/Citizen/SettingsScreen';
import { ToastProvider } from '../rescuer/context/ToastContext';
import { MainTabNavigator as RescuerTabNavigator } from '../rescuer/navigation/MainTabNavigator';
const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  SOS:      { active: 'warning',   inactive: 'warning-outline' },
  Status:   { active: 'bluetooth', inactive: 'bluetooth-outline' },
  Log:      { active: 'time',      inactive: 'time-outline' },
  Settings: { active: 'settings',  inactive: 'settings-outline' },
};

function CitizenTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
    id={undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom }],
        tabBarIcon: ({ focused }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={20}
                color={focused ? colors.primary : colors.textMuted}
              />
            </View>
          );
        },
        tabBarLabel: ({ focused }) => (
          <Text style={[typography.tabLabel, { color: focused ? colors.primary : colors.textMuted }]}>
            {route.name}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="SOS"      component={SOSScreen} />
      <Tab.Screen name="Status"   component={StatusScreen} />
      <Tab.Screen name="Log"      component={LogScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
    id={undefined}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login"   component={LoginScreen}   options={{ title: 'Login' }} />
      <Stack.Screen name="SignUp"  component={SignUpScreen}  options={{ title: 'Sign Up' }} />
      <Stack.Screen
        name="RescuerVerification"
        component={RescuerVerificationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user } = useAuth();
  return (
    <ToastProvider>
      <NavigationContainer>
        {!user ? (
          <AuthStack />
        ) : user.role === 'rescuer' ? (
          <RescuerTabNavigator />
        ) : (
          <CitizenTabs />
        )}
      </NavigationContainer>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 64,
    paddingTop: 6,
    paddingBottom: 8,
  },
  iconWrap: {
    width: 40, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primaryLight },
});
