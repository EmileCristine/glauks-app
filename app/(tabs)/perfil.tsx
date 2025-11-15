import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from "expo-status-bar";
import { Link, useRouter } from 'expo-router';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { auth, db } from '../../firebase/config';
import { ref, onValue, update, set } from 'firebase/database';
import { signOut, updateProfile, updateEmail } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';

// Defina a URL da imagem como constante
const DEFAULT_USER_AVATAR = 'https://img.freepik.com/premium-vector/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration_561158-3407.jpg';

interface UserData {
  id: string;
  email: string;
  rm: string;
  nome?: string;
  telefone?: string;
  endereco?: string;
  escola?: string;
  cidade?: string;
  estado?: string;
  foto?: string;
  temaEscuro?: boolean;
  notificacoes?: boolean;
  createdAt?: string;
}

export default function Perfil() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });

  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Partial<UserData>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Estados para as contagens reais
  const [emprestimosCount, setEmprestimosCount] = useState(0);
  const [reservasCount, setReservasCount] = useState(0);
  const [favoritosCount, setFavoritosCount] = useState(0);

  // Carregar dados do usuário e contagens
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeEmprestimos: (() => void) | null = null;
    let unsubscribeReservas: (() => void) | null = null;
    let unsubscribeFavoritos: (() => void) | null = null;

    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          router.replace('./login');
          return;
        }

        console.log('🔍 Carregando dados do usuário:', user.uid, user.email);

        const userRef = ref(db, 'users/' + user.uid);
        
        // Listener em tempo real para dados do usuário
        unsubscribeUser = onValue(userRef, (snapshot) => {
          console.log('👤 Dados do usuário recebidos:', snapshot.exists());
          if (snapshot.exists()) {
            const data = snapshot.val() as UserData;
            console.log('👤 Dados do usuário:', data);
            const userWithId = { 
              ...data, 
              id: user.uid,
              nome: data.nome || user.displayName || 'Aluno',
              escola: data.escola || 'ETEC Hortolândia',
              cidade: data.cidade || 'Hortolândia',
              estado: data.estado || 'SP',
              temaEscuro: data.temaEscuro || false,
              notificacoes: data.notificacoes !== false
            };
            
            console.log('👤 Usuário processado:', userWithId);
            setUserData(userWithId);
            setEditingData(userWithId);
          } else {
            console.log('👤 Criando perfil padrão...');
            // Criar perfil padrão se não existir
            createDefaultProfile(user.uid, user.email || '');
          }
          setLoading(false);
        });

        // Carregar contagens reais do banco
        const countUnsubscribes = await loadUserCounts(user.uid, user.email || '');
        if (countUnsubscribes) {
          unsubscribeEmprestimos = countUnsubscribes.unsubscribeEmprestimos;
          unsubscribeReservas = countUnsubscribes.unsubscribeReservas;
          unsubscribeFavoritos = countUnsubscribes.unsubscribeFavoritos;
        }

      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        setLoading(false);
      }
    };

    loadUserData();

    // Cleanup function
    return () => {
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeEmprestimos) unsubscribeEmprestimos();
      if (unsubscribeReservas) unsubscribeReservas();
      if (unsubscribeFavoritos) unsubscribeFavoritos();
    };
  }, []);

  // Carregar contagens reais do banco de dados
  const loadUserCounts = async (userId: string, userEmail: string) => {
    try {
      console.log('📊 Carregando contagens para:', userId, userEmail);
      
      // 1. Contar empréstimos ativos do usuário (tabela emprestimos)
      const emprestimosRef = ref(db, 'emprestimos');
      const emprestimosUnsubscribe = onValue(emprestimosRef, (snapshot) => {
        console.log('📚 Empréstimos snapshot:', snapshot.exists(), snapshot.size);
        if (snapshot.exists()) {
          const emprestimosData = snapshot.val();
          let count = 0;
          
          Object.keys(emprestimosData).forEach(key => {
            const emprestimo = emprestimosData[key];
            console.log('📚 Empréstimo:', key, 'userId:', emprestimo.userId, 'email:', emprestimo.emailUsuario, 'status:', emprestimo.status);
            if ((emprestimo.emailUsuario === userEmail || emprestimo.userId === userId) && 
                (emprestimo.status === 'emprestado' || emprestimo.status === 'atrasado')) {
              count++;
              console.log('✅ Empréstimo incluído:', key);
            }
          });
          
          console.log('📚 Total empréstimos:', count);
          setEmprestimosCount(count);
        } else {
          console.log('📚 Nenhum empréstimo encontrado');
          setEmprestimosCount(0);
        }
      });

      // 2. Contar reservas ativas do usuário (tabela reservas)
      const reservasRef = ref(db, 'reservas');
      const reservasUnsubscribe = onValue(reservasRef, (snapshot) => {
        console.log('📋 Reservas snapshot:', snapshot.exists(), snapshot.size);
        if (snapshot.exists()) {
          const reservasData = snapshot.val();
          let count = 0;
          
          Object.keys(reservasData).forEach(key => {
            const reserva = reservasData[key];
            console.log('📋 Reserva:', key, 'userId:', reserva.userId, 'email:', reserva.emailUsuario, 'status:', reserva.status);
            // Verificar se a reserva pertence ao usuário e está ativa
            if ((reserva.emailUsuario === userEmail || reserva.userId === userId) && 
                (reserva.status === 'pendente' || reserva.status === 'aprovada')) {
              count++;
              console.log('✅ Reserva incluída:', key);
            }
          });
          
          console.log('📋 Total reservas:', count);
          setReservasCount(count);
        } else {
          console.log('📋 Nenhuma reserva encontrada');
          setReservasCount(0);
        }
      });

      // 3. Contar favoritos do usuário
      const favoritosRef = ref(db, 'favoritos');
      const favoritosUnsubscribe = onValue(favoritosRef, (snapshot) => {
        console.log('❤️ Favoritos snapshot:', snapshot.exists(), snapshot.size);
        if (snapshot.exists()) {
          const favoritosData = snapshot.val();
          let count = 0;
          
          Object.keys(favoritosData).forEach(key => {
            const favorito = favoritosData[key];
            console.log('❤️ Favorito:', key, 'userId:', favorito.userId);
            // Verificar se o favorito pertence ao usuário
            if (favorito.userId === userId) {
              count++;
              console.log('✅ Favorito incluído:', key);
            }
          });
          
          console.log('❤️ Total favoritos:', count);
          setFavoritosCount(count);
        } else {
          console.log('❤️ Nenhum favorito encontrado');
          setFavoritosCount(0);
        }
      });

      return {
        unsubscribeEmprestimos: emprestimosUnsubscribe,
        unsubscribeReservas: reservasUnsubscribe,
        unsubscribeFavoritos: favoritosUnsubscribe
      };

    } catch (error) {
      console.error('Erro ao carregar contagens:', error);
      return null;
    }
  };

  const createDefaultProfile = async (userId: string, email: string) => {
    try {
      const user = auth.currentUser;
      const defaultData = {
        email: email,
        rm: user?.displayName || '000000',
        nome: 'Aluno',
        escola: 'ETEC Hortolândia',
        cidade: 'Hortolândia',
        estado: 'SP',
        temaEscuro: false,
        notificacoes: true,
        createdAt: new Date().toISOString(),
      };

      const userRef = ref(db, 'users/' + userId);
      await set(userRef, defaultData);
      
      setUserData({ id: userId, ...defaultData });
      setEditingData(defaultData);
    } catch (error) {
      console.error('Erro ao criar perfil padrão:', error);
    }
  };

  // Escolher foto da galeria - CORRIGIDA
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para alterar a foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].uri) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao escolher imagem:', error);
      Alert.alert('Erro', 'Não foi possível escolher a imagem.');
    }
  };

  // Upload da foto
  const uploadPhoto = async (uri: string) => {
    try {
      setUploadingPhoto(true);
      const user = auth.currentUser;
      if (!user) return;

      const userRef = ref(db, 'users/' + user.uid);
      await update(userRef, { foto: uri });
      
      // Atualizar tanto userData quanto editingData para manter a foto
      setUserData(prev => prev ? { ...prev, foto: uri } : null);
      setEditingData(prev => ({ ...prev, foto: uri }));
      Alert.alert('Sucesso', 'Foto de perfil atualizada!');
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Atualizar dados do usuário
  const updateUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !editingData.nome) {
        Alert.alert('Erro', 'Nome é obrigatório');
        return;
      }

      setSaving(true);
      const userRef = ref(db, 'users/' + user.uid);
      
      const updateData = {
        nome: editingData.nome,
        telefone: editingData.telefone || '',
        endereco: editingData.endereco || '',
        escola: editingData.escola || 'ETEC Hortolândia',
        cidade: editingData.cidade || 'Hortolândia',
        estado: editingData.estado || 'SP',
        email: editingData.email || userData?.email || '',
      };
      
      await update(userRef, updateData);
      
      if (editingData.nome !== userData?.nome) {
        await updateProfile(user, {
          displayName: editingData.nome
        });
      }
      
      if (editingData.email && editingData.email !== userData?.email) {
        await updateEmail(user, editingData.email);
      }
      
      setUserData(prev => prev ? { ...prev, ...updateData } : null);
      setEditMode(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      let errorMessage = 'Não foi possível atualizar o perfil.';
      
      if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Para alterar o email, faça login novamente.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Alternar tema
  const toggleTheme = async (value: boolean) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = ref(db, 'users/' + user.uid);
      await update(userRef, { temaEscuro: value });
    } catch (error) {
      console.error('Erro ao alterar tema:', error);
    }
  };

  // Alternar notificações
  const toggleNotifications = async (value: boolean) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = ref(db, 'users/' + user.uid);
      await update(userRef, { notificacoes: value });
    } catch (error) {
      console.error('Erro ao alterar notificações:', error);
    }
  };

  // Navegar para configurações
  const goToSettings = () => {
    Alert.alert('Configurações', 'Tela de configurações em desenvolvimento');
  };

  // Fazer logout
  const handleLogout = async () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('./login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
            }
          }
        }
      ]
    );
  };

  // Iniciar edição
  const startEditing = () => {
    setEditingData(userData || {});
    setEditMode(true);
  };

  // Cancelar edição
  const cancelEditing = () => {
    setEditingData(userData || {});
    setEditMode(false);
  };

  if (loading && !userData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#01babf" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.sectionTop}>
          <View style={styles.header}>
            <View style={[styles.sideContainer, styles.leftContainer]}>
              <TouchableOpacity onPress={() => router.back()}>
                <AntDesign name="arrowleft" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity>
              <Image
                style={styles.logo}
                source={require('../../assets/images/logo-branco.png')}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={[styles.sideContainer, styles.rightContainer]}>
              <TouchableOpacity>
                <MaterialIcons name="notifications-none" size={30} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Perfil */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              style={styles.profileImage}
              source={userData?.foto ? { uri: userData.foto } : { uri: DEFAULT_USER_AVATAR }}
            />
            <TouchableOpacity 
              style={styles.editPhotoButton}
              onPress={pickImage}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Feather name="camera" size={16} color="white" />
              )}
            </TouchableOpacity>
          </View>
          
          {editMode ? (
            <View style={styles.editForm}>
              <Text style={styles.editTitle}>Editar Perfil</Text>
              
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.input}
                value={editingData.nome || ''}
                onChangeText={(text) => setEditingData(prev => ({ ...prev, nome: text }))}
                placeholder="Digite seu nome completo"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>RM</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={editingData.rm || ''}
                editable={false}
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={editingData.email || ''}
                onChangeText={(text) => setEditingData(prev => ({ ...prev, email: text }))}
                placeholder="seu@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={editingData.telefone || ''}
                onChangeText={(text) => setEditingData(prev => ({ ...prev, telefone: text }))}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />

              <View style={styles.inputWithIcon}>
                <FontAwesome name="map-marker" size={16} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithIconPadding]}
                  value={editingData.endereco || ''}
                  onChangeText={(text) => setEditingData(prev => ({ ...prev, endereco: text }))}
                  placeholder="Endereço completo"
                  placeholderTextColor="#999"
                />
              </View>

              <Text style={styles.inputLabel}>Escola</Text>
              <TextInput
                style={styles.input}
                value={editingData.escola || ''}
                onChangeText={(text) => setEditingData(prev => ({ ...prev, escola: text }))}
                placeholder="Nome da escola"
                placeholderTextColor="#999"
              />

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={editingData.cidade || ''}
                    onChangeText={(text) => setEditingData(prev => ({ ...prev, cidade: text }))}
                    placeholder="Cidade"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Estado</Text>
                  <TextInput
                    style={styles.input}
                    value={editingData.estado || ''}
                    onChangeText={(text) => setEditingData(prev => ({ ...prev, estado: text }))}
                    placeholder="SP"
                    placeholderTextColor="#999"
                    maxLength={2}
                  />
                </View>
              </View>

              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={cancelEditing}
                  disabled={saving}
                >
                  <Text style={[styles.buttonText, { color: '#01babf' }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.saveButton]} 
                  onPress={updateUserData}
                  disabled={saving || !editingData.nome}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.buttonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.profileName}>{userData?.nome || 'Aluno'}</Text>
              <Text style={styles.profileEmail}>{userData?.email}</Text>
              
              {userData?.telefone && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={16} color="#666" style={styles.infoIcon} />
                  <Text style={styles.profileInfo}>{userData.telefone}</Text>
                </View>
              )}
              
              {userData?.endereco && (
                <View style={styles.infoRow}>
                  <FontAwesome name="map-marker" size={16} color="#666" style={styles.infoIcon} />
                  <Text style={styles.profileInfo}>{userData.endereco}</Text>
                </View>
              )}
              
              <View style={styles.infoRow}>
                <Ionicons name="school" size={16} color="#666" style={styles.infoIcon} />
                <Text style={styles.profileLocation}>
                  {userData?.escola}, {userData?.cidade}-{userData?.estado}
                </Text>
              </View>

              {/* Estatísticas atualizadas do banco */}
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{reservasCount}</Text>
                  <Text style={styles.statLabel}>Reservas</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{emprestimosCount}</Text>
                  <Text style={styles.statLabel}>Empréstimos</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{favoritosCount}</Text>
                  <Text style={styles.statLabel}>Favoritos</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Menu - Só mostra se não estiver editando */}
        {!editMode && (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={startEditing}>
              <View style={styles.menuItemContent}>
                <Feather name="edit-3" size={20} color="#333" />
                <Text style={styles.menuText}>Editar Perfil</Text>
              </View>
              <AntDesign name="right" size={16} color="#999" />
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemContent}>
                <Ionicons name="moon-outline" size={20} color="#333" />
                <Text style={styles.menuText}>Tema Escuro</Text>
              </View>
              <Switch 
                value={userData?.temaEscuro || false}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#01babf' }}
                thumbColor={userData?.temaEscuro ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>

            <View style={styles.menuItem}>
              <View style={styles.menuItemContent}>
                <Ionicons name="notifications-outline" size={20} color="#333" />
                <Text style={styles.menuText}>Notificações</Text>
              </View>
              <Switch 
                value={userData?.notificacoes !== false}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#767577', true: '#01babf' }}
                thumbColor={userData?.notificacoes !== false ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={goToSettings}>
              <View style={styles.menuItemContent}>
                <Ionicons name="settings-outline" size={20} color="#333" />
                <Text style={styles.menuText}>Configurações</Text>
              </View>
              <AntDesign name="right" size={16} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={handleLogout}>
              <View style={styles.menuItemContent}>
                <MaterialIcons name="logout" size={20} color="red" />
                <Text style={[styles.menuText, { color: 'red' }]}>Sair da Conta</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Espaço extra */}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

// Mantenha os estilos exatamente como você tinha...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Poppins-Regular',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 80,
    paddingTop: 45,
    marginBottom: 15,
  },
  sideContainer: {
    width: 80,
    alignItems: 'center',
  },
  leftContainer: {
    alignItems: 'flex-start',
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 100,
    height: 100,
  },
  sectionTop: {
    backgroundColor: '#0D0D00',
    height: 250, 
  },

  /* Perfil */
  profileSection: {
    alignItems: 'center',
    marginTop: -60,
    padding: 20,
    borderRadius: 25,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#fff',
    marginBottom: 20,
    shadowColor: '#0000008f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    marginTop: -60,
    backgroundColor: '#ddd',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 10,
    right: 0,
    backgroundColor: '#01babf',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f7f7f7',
  },
  profileName: {
    fontSize: 22,
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Poppins-Bold',

  },
  profileEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',

  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    justifyContent: 'center',
  },
  infoIcon: {
    marginRight: 6,
  },
  profileInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',

  },
  profileLocation: {
    fontSize: 13,
    color: 'gray',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',

  },

  /* Formulário de Edição */
  editForm: {
    width: '100%',
    marginTop: 0,
  },
  editTitle: {
    fontSize: 18,
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',

  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    marginLeft: 2,
    fontFamily: 'Poppins-Bold',

  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 25,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14,
    color: '#222222ff',
    fontFamily: 'Poppins-Regular',

  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  inputWithIconPadding: {
    paddingLeft: 40,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 5,
    borderRadius: 30,
    alignItems: 'center',
    marginHorizontal: 5,

  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#01babf',
    color: '#01babf',

  },
  saveButton: {
    backgroundColor: '#01babf',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',

  },

  /* Estatísticas */
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 20,
    paddingTop: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: 'gray',
    marginTop: 2,
  },

  /* Menu */
  menu: {
    marginTop: 10,
    paddingHorizontal: 20,
    margin: 20,
    backgroundColor: '#f7f7f7',
    borderRadius: 25,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#000',
  },
  logoutButton: {
    marginTop: 10,
    borderBottomWidth: 0,
  },
  bottomSpace: {
    height: 30,
  },
});