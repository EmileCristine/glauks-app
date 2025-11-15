import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import {ScrollView, StyleSheet, Text, View, Image, FlatList, TouchableOpacity, Alert, Modal, TextInput, StatusBar} from "react-native";
import Header from "../components/header";
import { auth, db } from "../../firebase/config";
import { getUserBooks, getBookMeta, Reservation } from "../../services/reservationsService";
import { Ionicons } from "@expo/vector-icons";
import { ref, onValue, off, set, get, runTransaction } from 'firebase/database';

type MyBook = { 
  id: string; 
  titulo?: string; 
  autor?: string; 
  capa?: string; 
  progresso: number; 
  avaliacao: number; 
  totalAvaliacoes: number; 
  autorFoto?: string;
  paginas?: string;
  genero?: string;
  editora?: string;
  finished?: boolean;
};

export default function Emprestar() {
  const [loaded, error] = useFonts({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
  const [meusLivros, setMeusLivros] = useState<MyBook[]>([]);
  const [userRatings, setUserRatings] = useState<{[bookId: string]: number}>({});
  const [hoveredRatings, setHoveredRatings] = useState<{[bookId: string]: number}>({});
  const [selectedBook, setSelectedBook] = useState<MyBook | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pagesRead, setPagesRead] = useState<string>('');
  const [bookProgress, setBookProgress] = useState<{[bookId: string]: { progress: number; finished: boolean; pagesRead: number }}>({});

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    async function loadUserBooks() {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userBooks = await getUserBooks(uid);
      
      // Buscar informações completas dos livros
      const mapped: MyBook[] = await Promise.all(userBooks.map(async (r) => {
        const meta = await getBookMeta(r.bookId);
        
        // Buscar informações completas do livro
        const bookRef = ref(db, `livros/${r.bookId}`);
        const bookSnap = await get(bookRef);
        const bookData = bookSnap.exists() ? bookSnap.val() : {};
        
        // Buscar avaliação do livro
        const ratingRef = ref(db, `bookRatingsSummary/${r.bookId}`);
        const ratingSnap = await get(ratingRef);
        const ratingData = ratingSnap.exists() ? ratingSnap.val() : { average: 0, total: 0 };
        
        // Buscar progresso do usuário
        const progressRef = ref(db, `userBookProgress/${uid}/${r.bookId}`);
        const progressSnap = await get(progressRef);
        const progressData = progressSnap.exists() ? progressSnap.val() : { progress: 0, pagesRead: 0, finished: false };
        
        const totalPages = parseInt(bookData.paginas || '0');
        const pagesRead = progressData.pagesRead || 0;
        const progress = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
        
        return {
          id: r.bookId,
          titulo: meta?.titulo || bookData.titulo || 'Livro emprestado',
          autor: meta?.autor || bookData.autor || '—',
          capa: meta?.capa || bookData.capa || 'https://via.placeholder.com/100x150?text=Livro',
          progresso: progress,
          avaliacao: ratingData.average || 0,
          totalAvaliacoes: ratingData.total || 0,
          autorFoto: 'https://via.placeholder.com/24',
          paginas: bookData.paginas || '0',
          genero: bookData.genero,
          editora: bookData.editora,
          finished: progressData.finished || false,
        };
      }));
      
      // Filtrar apenas livros não finalizados
      const activeBooks = mapped.filter(livro => !livro.finished);
      setMeusLivros(activeBooks);
    }
    loadUserBooks();
  }, []);

  // Escutar mudanças nas avaliações dos livros
  useEffect(() => {
    if (meusLivros.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    meusLivros.forEach((livro) => {
      const ratingRef = ref(db, `bookRatingsSummary/${livro.id}`);
      const handler = onValue(ratingRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setMeusLivros(prev => prev.map(l => 
            l.id === livro.id 
              ? { ...l, avaliacao: data.average || 0, totalAvaliacoes: data.total || 0 }
              : l
          ));
        }
      });
      unsubscribes.push(() => off(ratingRef, 'value', handler));
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [meusLivros]);

  // Buscar avaliações do usuário para cada livro
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || meusLivros.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    meusLivros.forEach((livro) => {
      const userRatingRef = ref(db, `bookRatings/${livro.id}/${uid}`);
      const handler = onValue(userRatingRef, (snap) => {
        if (snap.exists()) {
          setUserRatings(prev => ({
            ...prev,
            [livro.id]: snap.val().rating || 0
          }));
        } else {
          setUserRatings(prev => {
            const newRatings = { ...prev };
            delete newRatings[livro.id];
            return newRatings;
          });
        }
      });
      unsubscribes.push(() => off(userRatingRef, 'value', handler));
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [meusLivros]);

  // Buscar progresso dos livros
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || meusLivros.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    meusLivros.forEach((livro) => {
      const progressRef = ref(db, `userBookProgress/${uid}/${livro.id}`);
      const handler = onValue(progressRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setBookProgress(prev => ({
            ...prev,
            [livro.id]: {
              progress: data.progress || 0,
              pagesRead: data.pagesRead || 0,
              finished: data.finished || false
            }
          }));
          
          // Atualizar progresso na lista
          const totalPages = parseInt(livro.paginas || '0');
          const pagesRead = data.pagesRead || 0;
          const progress = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
          
          setMeusLivros(prev => prev.map(l => 
            l.id === livro.id 
              ? { ...l, progresso: progress, finished: data.finished || false }
              : l
          ));
        }
      });
      unsubscribes.push(() => off(progressRef, 'value', handler));
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [meusLivros]);

  // Função para salvar avaliação
  const handleRatingPress = async (bookId: string, rating: number) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Erro', 'Você precisa estar logado para avaliar');
      return;
    }

    try {
      // Buscar avaliação anterior do usuário
      const previousRatingRef = ref(db, `bookRatings/${bookId}/${uid}`);
      const previousSnap = await get(previousRatingRef);
      const previousRating = previousSnap.exists() ? previousSnap.val().rating : 0;

      // Salvar avaliação do usuário
      await set(ref(db, `bookRatings/${bookId}/${uid}`), {
        rating,
        createdAt: Date.now()
      });

      // Atualizar resumo de avaliações usando transação
      const summaryRef = ref(db, `bookRatingsSummary/${bookId}`);
      await runTransaction(summaryRef, (current) => {
        const summary = current || { total: 0, sum: 0, average: 0 };
        
        if (previousRating > 0) {
          // Atualizar avaliação existente
          summary.sum = (summary.sum || 0) - previousRating + rating;
        } else {
          // Nova avaliação
          summary.total = (summary.total || 0) + 1;
          summary.sum = (summary.sum || 0) + rating;
        }
        
        summary.average = summary.total > 0 ? summary.sum / summary.total : 0;
        
        return summary;
      });

      // Atualizar estado local
      setUserRatings(prev => ({
        ...prev,
        [bookId]: rating
      }));

      // A atualização da média será feita automaticamente pelo listener do Firebase
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      Alert.alert('Erro', 'Não foi possível salvar a avaliação');
    }
  };

  if (!loaded && !error) {
    return null;
  }

  const renderEstrelas = (bookId: string, avaliacao: number) => {
    const userRating = userRatings[bookId] || 0;
    const hoveredRating = hoveredRatings[bookId] || 0;
    
    // Mostrar hover se estiver interagindo, senão mostrar avaliação do usuário ou média
    const displayRating = hoveredRating > 0 ? hoveredRating : (userRating > 0 ? userRating : avaliacao);
    
    const estrelas = [];
    const estrelasInteiras = Math.floor(displayRating);
    const temMeiaEstrela = displayRating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      const starValue = i + 1;
      const isFilled = i < estrelasInteiras;
      const isHalf = i === estrelasInteiras && temMeiaEstrela;
      
      estrelas.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleRatingPress(bookId, starValue)}
          onPressIn={() => setHoveredRatings(prev => ({ ...prev, [bookId]: starValue }))}
          onPressOut={() => setHoveredRatings(prev => {
            const newRatings = { ...prev };
            delete newRatings[bookId];
            return newRatings;
          })}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFilled ? 'star' : isHalf ? 'star-half' : 'star-outline'}
            size={14}
            color="#FFD700"
          />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.estrelasContainer}>{estrelas}</View>;
  };

  // Função para abrir modal
  const openBookModal = async (book: MyBook) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    // Buscar progresso atual do Firebase
    try {
      const progressRef = ref(db, `userBookProgress/${uid}/${book.id}`);
      const progressSnap = await get(progressRef);
      const progressData = progressSnap.exists() ? progressSnap.val() : { pagesRead: 0 };
      setPagesRead(progressData.pagesRead?.toString() || '0');
    } catch (error) {
      console.error('Erro ao buscar progresso:', error);
      setPagesRead('0');
    }
    
    setSelectedBook(book);
    setModalVisible(true);
  };

  // Função para salvar progresso
  const handleSaveProgress = async () => {
    if (!selectedBook) return;
    
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Erro', 'Você precisa estar logado');
      return;
    }

    const pagesReadNum = parseInt(pagesRead) || 0;
    const totalPages = parseInt(selectedBook.paginas || '0');
    
    if (totalPages === 0) {
      Alert.alert('Erro', 'Número de páginas do livro não encontrado');
      return;
    }

    if (pagesReadNum < 0 || pagesReadNum > totalPages) {
      Alert.alert('Erro', `O número de páginas deve estar entre 0 e ${totalPages}`);
      return;
    }

    try {
      const progress = Math.round((pagesReadNum / totalPages) * 100);
      
      await set(ref(db, `userBookProgress/${uid}/${selectedBook.id}`), {
        pagesRead: pagesReadNum,
        progress: progress,
        finished: false,
        updatedAt: Date.now()
      });

      Alert.alert('Sucesso', 'Progresso salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      Alert.alert('Erro', 'Não foi possível salvar o progresso');
    }
  };

  // Função para finalizar leitura
  const handleFinishReading = async () => {
    if (!selectedBook) return;
    
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Erro', 'Você precisa estar logado');
      return;
    }

    Alert.alert(
      'Finalizar Leitura',
      'Tem certeza que deseja finalizar a leitura deste livro? Ele será removido de "Meus Livros" mas permanecerá em "Empréstimos".',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              const progress = bookProgress[selectedBook.id];
              const pagesReadNum = progress?.pagesRead || parseInt(pagesRead) || 0;
              const totalPages = parseInt(selectedBook.paginas || '0');
              const finalProgress = totalPages > 0 ? Math.round((pagesReadNum / totalPages) * 100) : 100;
              
              await set(ref(db, `userBookProgress/${uid}/${selectedBook.id}`), {
                pagesRead: pagesReadNum,
                progress: finalProgress,
                finished: true,
                finishedAt: Date.now(),
                updatedAt: Date.now()
              });

              // Remover da lista local
              setMeusLivros(prev => prev.filter(l => l.id !== selectedBook.id));
              setModalVisible(false);
              setSelectedBook(null);
              
              Alert.alert('Sucesso', 'Leitura finalizada! O livro foi removido de "Meus Livros".');
            } catch (error) {
              console.error('Erro ao finalizar leitura:', error);
              Alert.alert('Erro', 'Não foi possível finalizar a leitura');
            }
          }
        }
      ]
    );
  };

  const renderLivro = ({ item }: { item: typeof meusLivros[0] }) => (
    <TouchableOpacity 
      style={styles.livros}
      onPress={() => openBookModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.capaCover}>
        <Image 
          source={{ uri: item.capa }} 
          style={styles.capaImg}
        />
      </View>

      <View style={styles.info}>
        {/* Barra de progresso */}
        <View style={styles.progressoContainer}>
          <Text style={styles.porcentagem}>{item.progresso}%</Text>
          <View style={styles.barraProgressoBackground}>
            <View style={[styles.barraProgressoPreenchimento, { width: `${item.progresso}%` }]} />
          </View>
        </View>

        {/* Título do livro */}
        <Text style={styles.infoTitle}>{item.titulo}</Text>
        
        {/* Estrelas, pontuação e total de avaliação */}
        <View style={styles.avaliacaoContainer}>
          {renderEstrelas(item.id, item.avaliacao)}
          <Text style={styles.pontuacao}>
            {item.avaliacao > 0 ? item.avaliacao.toFixed(1) : '0'} ({item.totalAvaliacoes} {item.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})
          </Text>
        </View>

        {/* Foto e nome do autor */}
        <View style={styles.autorContainer}>
          <Image source={{ uri: item.autorFoto }} style={styles.autorFoto} />
          <Text style={styles.autorNome}>{item.autor}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar 
      barStyle={modalVisible ? 'dark-content' : 'dark-content'}
    />
      <Header/>

      <Text style={styles.title}>Minha Leitura</Text>
      
      {meusLivros.length > 0 ? (
        <FlatList
          data={meusLivros}
          renderItem={renderLivro}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listaContainer}
        />
      ) : (
        <Text style={styles.emptyText}>Nenhum livro emprestado ainda</Text>
      )}

      {/* Modal de detalhes do livro */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedBook(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedBook && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Detalhes do Livro</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      setSelectedBook(null);
                    }}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.modalBookInfo}>
                    <Image 
                      source={{ uri: selectedBook.capa }} 
                      style={styles.modalCover}
                    />
                    <View style={styles.modalBookDetails}>
                      <Text style={styles.modalBookTitle}>{selectedBook.titulo}</Text>
                      <Text style={styles.modalBookAuthor}>{selectedBook.autor}</Text>
                      {selectedBook.genero && (
                        <Text style={styles.modalBookGenre}>{selectedBook.genero}</Text>
                      )}
                      {selectedBook.paginas && (
                        <Text style={styles.modalBookPages}>{selectedBook.paginas} páginas</Text>
                      )}
                    </View>
                  </View>

                  {/* Avaliação */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Avaliação</Text>
                    <View style={styles.modalRatingContainer}>
                      <View style={styles.modalStarsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const userRating = userRatings[selectedBook.id] || 0;
                          const hoveredRating = hoveredRatings[selectedBook.id] || 0;
                          const displayRating = hoveredRating > 0 ? hoveredRating : (userRating > 0 ? userRating : selectedBook.avaliacao);
                          
                          const isFilled = star <= Math.floor(displayRating);
                          const isHalf = star === Math.ceil(displayRating) && displayRating % 1 >= 0.5 && !isFilled;
                          
                          return (
                            <TouchableOpacity
                              key={star}
                              onPress={() => handleRatingPress(selectedBook.id, star)}
                              onPressIn={() => setHoveredRatings(prev => ({ ...prev, [selectedBook.id]: star }))}
                              onPressOut={() => setHoveredRatings(prev => {
                                const newRatings = { ...prev };
                                delete newRatings[selectedBook.id];
                                return newRatings;
                              })}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={isFilled ? 'star' : isHalf ? 'star-half' : 'star-outline'}
                                size={20}
                                color="#FFD700"
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={styles.modalRatingText}>
                        {selectedBook.avaliacao > 0 ? (
                          <>
                            {selectedBook.avaliacao.toFixed(1)} ({selectedBook.totalAvaliacoes} {selectedBook.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})
                          </>
                        ) : (
                          'Sem avaliações'
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Progresso de leitura */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Progresso de Leitura</Text>
                    <View style={styles.progressInputContainer}>
                      <Text style={styles.progressLabel}>Páginas lidas:</Text>
                      <TextInput
                        style={styles.progressInput}
                        value={pagesRead}
                        onChangeText={setPagesRead}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#999"
                      />
                      <Text style={styles.progressTotal}>
                        / {selectedBook.paginas || '0'} páginas
                      </Text>
                    </View>
                    {selectedBook.paginas && parseInt(selectedBook.paginas) > 0 && (() => {
                      const totalPages = parseInt(selectedBook.paginas || '1');
                      const pagesReadNum = parseInt(pagesRead) || 0;
                      const progressPercent = Math.min(100, Math.round((pagesReadNum / totalPages) * 100));
                      
                      return (
                        <>
                          <View style={styles.modalProgressBar}>
                            <View style={styles.modalProgressBarBackground}>
                              <View 
                                style={[
                                  styles.modalProgressBarFill, 
                                  { width: `${progressPercent}%` }
                                ]} 
                              />
                            </View>
                            <Text style={styles.modalProgressPercent}>
                              {progressPercent}%
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.saveProgressButton}
                            onPress={handleSaveProgress}
                          >
                            <Text style={styles.saveProgressButtonText}>Salvar Progresso</Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>

                  {/* Botão finalizar leitura */}
                  <TouchableOpacity
                    style={styles.finishButton}
                    onPress={handleFinishReading}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.finishButtonText}>Finalizar Leitura</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listaContainer: {
    paddingBottom: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginBottom: 15,
    color: '#333',
    marginLeft: 20,
    marginTop: 20,
  },
  livros: {
    flexDirection: 'row',
    backgroundColor: '#f7f7f7',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    alignItems: 'center',
  },
  capaCover: {
    height: 150,
    width: 100,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 15,
  },
  capaImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  info: {
    flex: 1,
  },
  progressoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  porcentagem: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#01BABF',
    marginRight: 10,
    minWidth: 35,
  },
  barraProgressoBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barraProgressoPreenchimento: {
    height: '100%',
    backgroundColor: '#01BABF',
    borderRadius: 3,
  },
  infoTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  avaliacaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  estrelasContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  pontuacao: {
    fontFamily: 'Poppins-Regular',
    fontSize: 10,
    color: '#666',
  },
  autorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autorFoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  autorNome: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
    fontStyle: 'italic'
  },
  modalOverlay: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalBookInfo: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalCover: {
    width: 100,
    height: 150,
    borderRadius: 10,
    marginRight: 15,
  },
  modalBookDetails: {
    flex: 1,
  },
  modalBookTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
  modalBookAuthor: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#01babf',
    marginBottom: 5,
  },
  modalBookGenre: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  modalBookPages: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalSectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  modalRatingContainer: {
    alignItems: 'center',
  },
  modalStarsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 5,
  },
  modalRatingText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#666',
  },
  progressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  progressLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#333',
  },
  progressInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  progressTotal: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
  },
  modalProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  modalProgressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalProgressBarFill: {
    height: '100%',
    backgroundColor: '#01BABF',
    borderRadius: 4,
  },
  modalProgressPercent: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#01BABF',
    minWidth: 40,
    textAlign: 'right',
  },
  saveProgressButton: {
    backgroundColor: '#f7f7f7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: 'center',
    borderColor: '#01babf',
    borderStyle: 'solid',
    borderWidth: 2
  },
  saveProgressButtonText: {
    color: '#01babf',
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
  },
  finishButton: {
    flexDirection: 'row',
    backgroundColor: '#01babf',
    paddingVertical: 15,
    paddingHorizontal: 20,
    margin: 20,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
});