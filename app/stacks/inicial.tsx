import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Color constants
const COLORS = {
  background: '#0D0D00',
  blue: '#01BABF',
  white: '#FFF',
  black: '#0D0D00',
};

  const router = useRouter();

export default function InitialScreen() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          style={styles.logo}
          source={require('../../assets/images/logo-branco.png')}
          resizeMode="contain"
        />
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.buttonsContainer}>
          {/* Login Button */}
            <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/stacks/login')}>
              <Text style={[styles.loginButtonText, styles.buttonText]}>Entrar</Text>
            </TouchableOpacity>

          {/* Register Button */}
            <TouchableOpacity style={styles.registerButton} onPress={() => router.push('/stacks/signup')}>
              <Text style={[styles.registerButtonText, styles.buttonText]}>Cadastrar</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  bottomContainer: {
    padding: 20,
    paddingBottom: 60,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  registerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButtonText: {
    color: COLORS.black,
  },
  registerButtonText: {
    color: COLORS.white,
  },
});