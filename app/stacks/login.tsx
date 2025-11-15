import { MaterialIcons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config'

export default function Login() {
  const navigation = useNavigation();
  const router = useRouter();
  
  // Estados para os campos e loading
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    // Validação simples
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setIsLoading(true);

    try {
      // Autenticação com Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login bem-sucedido:', user.uid);
      
      // Redirecionar para a home após login bem-sucedido
      router.push('/(tabs)/home');
      
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      // Tratamento de erros específicos do Firebase
      let errorMessage = 'Erro ao fazer login. Tente novamente.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'E-mail inválido.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Esta conta foi desativada.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erro de conexão. Verifique sua internet.';
          break;
        default:
          errorMessage = error.message || 'Erro desconhecido.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={-100}>
        <StatusBar />
        <View style={styles.container}>
          <View style={styles.topSection}>
            <Image
              style={styles.backgroundImage}
              source={require('../../assets/images/background.png')}
              resizeMode="cover"
            />

            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <AntDesign name="arrowleft" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.textContainer}>
              <Text style={styles.loginTitle}>Log In</Text>
              <Text style={styles.loginSubtitle}>
                Acesse o acervo da biblioteca. Faça login para explorar, reservar e descobrir novos livros
              </Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <ScrollView 
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Image
                style={styles.logo}
                source={require('../../assets/images/logo-preto.png')}
                resizeMode="contain"
              />

              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu e-mail"
                placeholderTextColor='#666'
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={styles.label}>Senha</Text>
              <View style={{ width: '100%', position: 'relative' }}>
                <TextInput
                  style={[styles.input, { paddingRight: 40 }]}
                  placeholder="Digite sua senha"
                  placeholderTextColor='#666'
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 15, top: 12 }}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={24}
                    color="#01babf"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              {/* Link para recuperação de senha */}
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D00',
  },
  topSection: {
    height: '50%',
    width: '100%',
    position: 'relative',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  backButton: {
    position: 'absolute',
    top: 45,
    left: 20,
    zIndex: 10,
    borderRadius: 20,
    padding: 10,
  },
  textContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    zIndex: 2,
  },
  loginTitle: {
    fontSize: 35,
    fontWeight: '900',
    color: 'white',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  loginSubtitle: {
    fontSize: 14,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  formSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    marginTop: -70,
    paddingHorizontal: 40,
  },
  formContent: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 20,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: -30,
    marginTop: -15
  },
  label: {
    alignSelf: 'flex-start',
    marginLeft: 15,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f7f7f7',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginBottom: 10,
    fontSize: 16,
    outlineColor: '#fff',
  },
  loginButton: {
    width: '100%',
    height: 55,
    backgroundColor: '#01BABF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  quickLoginButton: {
    width: '100%',
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#01BABF',
  },
  quickLoginText: {
    fontSize: 14,
    color: '#01BABF',
    fontWeight: '500',
  },
  forgotPassword: {
    marginTop: 15,
    padding: 10,
  },
  forgotPasswordText: {
    color: '#01BABF',
    fontSize: 14,
    fontWeight: '500',
  },
});