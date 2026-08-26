// mobile/src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const LoginScreen = ({ navigation }) => {
  const [hospitalId, setHospitalId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!hospitalId || !password) {
      Alert.alert('Error', 'Please enter Hospital ID and Password');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/api/patient/login', {
        hospitalId,
        password
      });

      await AsyncStorage.setItem('patient_token', response.data.token);
      await AsyncStorage.setItem('patient_data', JSON.stringify(response.data.patient));

      navigation.replace('Main');
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error.response?.data?.error || 'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.loginBox}>
        <Text style={styles.title}>🏥 NexGen EMR</Text>
        <Text style={styles.subtitle}>Patient Portal</Text>
        <Text style={styles.description}>Access your medical records</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Hospital ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 000001"
            value={hospitalId}
            onChangeText={setHospitalId}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.loginButtonText}>🔐 Secure Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          💡 Contact the hospital to enable portal access
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBox: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f3460',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#1a1a2e',
    textAlign: 'center',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  loginButton: {
    backgroundColor: '#0f3460',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPassword: {
    color: '#0f3460',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  helpText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
  },
});

export default LoginScreen;