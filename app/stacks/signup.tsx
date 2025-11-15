import { MaterialIcons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../../firebase/config';

export default function SignUp() {
  const router = useRouter();
  
  // Estados para os campos e loading
  const [email, setEmail] = useState<string>('');
  const [rm, setRm] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    // Validação simples
    if (!email || !rm || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Salvar dados adicionais no Realtime Database
      const userRef = ref(db, 'users/' + user.uid);
      await set(userRef, {
        email: email,
        rm: rm,
        createdAt: new Date().toISOString(),
      });

      // Atualizar perfil do usuário (opcional)
      await updateProfile(user, {
        displayName: rm,
      });

      Alert.alert('Sucesso', 'Cadastro realizado com sucesso!');
      router.push('/(tabs)/home');
      
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      
      // Tratamento de erros específicos do Firebase
      let errorMessage = 'Erro ao criar conta. Tente novamente.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este e-mail já está em uso.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'E-mail inválido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Operação não permitida.';
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
              <Text style={styles.loginTitle}>Sign Up</Text>
              <Text style={styles.loginSubtitle}>
                Crie sua conta para acessar o acervo da biblioteca. Explore, reserve e descubra novos livros.
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

              <Text style={styles.label}>Email</Text>
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

              <Text style={styles.label}>RM</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu RM"
                placeholderTextColor='#666'
                value={rm}
                onChangeText={setRm}
                keyboardType="numeric"
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
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={24}
                    color="#01babf"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Cadastrar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
    </KeyboardAvoidingView>
  );
}

// Os styles permanecem os mesmos
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
    height: '45%',
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
    marginTop: -75,
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
    color: '#333',
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
    marginBottom: 20,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});