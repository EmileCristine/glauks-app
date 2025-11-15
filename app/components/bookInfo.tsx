import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  Image, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  Alert
} from 'react-native';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { reserveBook, listenIsBookReservedByUser } from '../../services/reservationsService';
import { useFonts } from "expo-font";

interface Book {
  id: string;
  titulo: string;
  autor: string;
  genero: string;
  paginas: string;
  isbn: string;
  sinopse: string;
  capa: string;
  editora?: string;
  dataPublicacao?: string;
  dataAdicao: string;
}

export default function BookInfo() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });

  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [alreadyReserved, setAlreadyReserved] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [synopsisNeedsTruncation, setSynopsisNeedsTruncation] = useState(false);
  const [bookRating, setBookRating] = useState<{ average: number; total: number }>({ average: 0, total: 0 });

  useEffect(() => {
    if (id) {
      // Resetar estados quando mudar de livro
      setShowFullSynopsis(false);
      setSynopsisNeedsTruncation(false);
      
      const bookRef = ref(db, `livros/${id}`);
      
      const unsubscribe = onValue(bookRef, (snapshot) => {
        if (snapshot.exists()) {
          setBook({
            id: snapshot.key!,
            ...snapshot.val()
          });
        } else {
          setBook(null);
        }
        setLoading(false);
      });

      return () => off(bookRef, 'value', unsubscribe);
    }
  }, [id]);

  useEffect(() => {
    if (!book?.id) return;
    const unsub = listenIsBookReservedByUser(book.id, setAlreadyReserved);
    return () => unsub && unsub();
  }, [book?.id]);

  useEffect(() => {
    if (!book?.id) return;
    const statusRef = ref(db, `bookStatus/${book.id}`);
    const handler = onValue(statusRef, (snap) => {
      if (snap.exists()) {
        const v = snap.val();
        setAvailable(!!v.available);
      } else {
        // Se não existir, considerar disponível por padrão
        setAvailable(true);
      }
    });
    return () => off(statusRef, 'value', handler);
  }, [book?.id]);

  // Buscar avaliação do livro
  useEffect(() => {
    if (!book?.id) return;
    
    const ratingRef = ref(db, `bookRatingsSummary/${book.id}`);
    const handler = onValue(ratingRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setBookRating({
          average: data.average || 0,
          total: data.total || 0
        });
      } else {
        setBookRating({ average: 0, total: 0 });
      }
    });
    
    return () => off(ratingRef, 'value', handler);
  }, [book?.id]);


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#01babf" />
        <Text style={styles.loadingText}>Carregando livro...</Text>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="book-outline" size={64} color="#ccc" />
        <Text style={styles.errorText}>Livro não encontrado</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Livro</Text>
        <View style={{ width: 24 }} /> {/* Espaço para alinhamento */}
      </View>

      {/* Capa do livro */}
      <Image 
        source={{ uri: book.capa || 'https://via.placeholder.com/200x300/01babf/ffffff?text=Sem+Capa' }} 
        style={styles.cover} 
      />
      
      {/* Informações principais */}
      <Text style={styles.title}>{book.titulo}</Text>
      <Text style={styles.author}>{book.autor}</Text>
      
      {/* Avaliação - Apenas visualização */}
      {bookRating.average > 0 && (
        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= Math.floor(bookRating.average);
              const isHalf = star === Math.ceil(bookRating.average) && bookRating.average % 1 >= 0.5 && !isFilled;
              
              return (
                <Ionicons
                  key={star}
                  name={isFilled ? 'star' : isHalf ? 'star-half' : 'star-outline'}
                  size={16}
                  color="#FFD700"
                />
              );
            })}
          </View>
          <Text style={styles.ratingText}>
            {bookRating.average.toFixed(1)} ({bookRating.total} {bookRating.total === 1 ? 'avaliação' : 'avaliações'})
          </Text>
        </View>
      )}
      
      {/* Metadados */}
      <View style={styles.metadataContainer}>
        <View style={styles.metadataItem}>
          <Ionicons name="book-outline" size={20} color="#01babf" />
          <Text style={styles.metadataText}>{book.paginas} páginas</Text>
        </View>
        
        <View style={styles.metadataItem}>
          <Ionicons name="library-outline" size={20} color="#01babf" />
          <Text style={styles.metadataText}>{book.genero}</Text>
        </View>
        
        {book.editora && (
          <View style={styles.metadataItem}>
            <Ionicons name="business-outline" size={20} color="#01babf" />
            <Text style={styles.metadataText}>{book.editora}</Text>
          </View>
        )}
      </View>

      {/* Sinopse */}
      <View style={styles.synopsisContainer}>
        <Text style={styles.sectionTitle}>Sinopse</Text>
        <Text 
          style={styles.synopsis}
          numberOfLines={showFullSynopsis ? undefined : 3}
          onTextLayout={(e) => {
            const { lines } = e.nativeEvent;
            if (showFullSynopsis) {
              setSynopsisNeedsTruncation(lines.length > 3);
            } else {
              const estimatedLines = book.sinopse ? Math.ceil(book.sinopse.length / 50) : 0;
              setSynopsisNeedsTruncation(lines.length >= 3 || estimatedLines > 3);
            }
          }}
        >
          {book.sinopse || 'Sinopse não disponível para este livro.'}
        </Text>
        {book.sinopse && book.sinopse.length > 0 && (
          <TouchableOpacity 
            onPress={() => setShowFullSynopsis(!showFullSynopsis)}
            style={styles.seeMoreButton}
          >
            <Text style={styles.seeMoreText}>
              {showFullSynopsis ? 'Ver menos' : 'Ver mais'}
            </Text>
            <Ionicons 
              name={showFullSynopsis ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color="#01babf" 
            />
          </TouchableOpacity>
        )}
      </View>


      {/* Botões de ação */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.readButton, (reserving || alreadyReserved) && { opacity: 0.7 }]}
          disabled={reserving || alreadyReserved}
          onPress={async () => {
            try {
              setReserving(true);
              await reserveBook(book.id);
              setAlreadyReserved(true);
              Alert.alert('Reserva feita', 'Sua solicitação foi enviada e aguarda aprovação do administrador.');
            } catch (e: any) {
              Alert.alert('Não foi possível reservar', e?.message || 'Tente novamente mais tarde.');
            } finally {
              setReserving(false);
            }
          }}
        >
          {alreadyReserved ? (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.readButtonText}>Reservado</Text>
            </>
          ) : reserving ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.readButtonText}>Reservando…</Text>
            </>
          ) : (
            <>
              <Ionicons name="bookmark-outline" size={20} color="#fff" />
              <Text style={styles.readButtonText}>{available === false ? 'Entrar na fila' : 'Reservar'}</Text>
            </>
          )}
        </TouchableOpacity>
        
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  container: { 
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 40,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'Poppins-Bold',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#01babf',
    fontSize: 16,
    fontWeight: '500',
  },
  cover: { 
    width: 180, 
    height: 250, 
    borderRadius: 12, 
    alignSelf: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: { 
    fontSize: 20, 
    textAlign: 'center', 
    marginTop: 20,
    marginHorizontal: 20,
    color: '#333',
    fontFamily: 'Poppins-Bold',
  },
  author: { 
    fontSize: 14, 
    color: '#01babf', 
    marginTop: 5,
    textAlign: 'center',
    marginHorizontal: 20,
    fontFamily: 'Poppins-Regular',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Poppins-Regular',
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  metadataItem: {
    alignItems: 'center',
    flex: 1,
  },
  metadataText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  isbnContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  isbnLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  synopsisContainer: {
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    fontFamily: 'Poppins-Bold',
  },
  synopsis: {
    fontSize: 13,
    color: '#555',
    lineHeight: 22,
    textAlign: 'justify',
    fontFamily: 'Poppins-Regular',
  },
  seeMoreButton: {
    flexDirection: 'row',
    marginTop: 5,
    paddingVertical: 4,
  },
  seeMoreText: {
    fontSize: 12,
    color: '#01babf',
    fontWeight: '600',
    marginRight: 5,
    marginBottom: 5,
    fontFamily: 'Poppins-Regular',
      },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Poppins-Regular',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 0,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  readButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#01babf',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  readButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
});