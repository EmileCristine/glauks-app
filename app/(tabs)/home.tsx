import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../components/header";
import { SplashScreen, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ref, onValue, off, query, orderByChild, limitToFirst } from 'firebase/database';
import { db, auth } from '../../firebase/config';
import { getAuthorWithPhoto, syncAuthorsToFirebase, Author } from '../../services/authorService';
import { useFonts } from "expo-font";
import { getUserBooks, getBookMeta } from '../../services/reservationsService';

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

interface MyBook {
  id: string;
  titulo: string;
  autor: string;
  capa: string;
  progresso: number;
}

export default function Home() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [userBooks, setUserBooks] = useState<MyBook[]>([]);
  const [loadingUserBooks, setLoadingUserBooks] = useState(false);
  const router = useRouter();
  const user = auth.currentUser;

  // Buscar livros do Firebase
  useEffect(() => {
    setLoadingBooks(true);
    
    const booksRef = query(ref(db, 'livros'), limitToFirst(10));
    
    const unsubscribe = onValue(booksRef, (snapshot) => {
      if (snapshot.exists()) {
        const booksData: Book[] = [];
        snapshot.forEach((childSnapshot) => {
          booksData.push({
            id: childSnapshot.key!,
            ...childSnapshot.val()
          });
        });
        setBooks(booksData);
        
        // Sincronizar autores automaticamente
        syncAuthorsToFirebase(booksData);
      }
      setLoadingBooks(false);
    });

    return () => off(booksRef, 'value', unsubscribe);
  }, []);

  // Buscar autores
  useEffect(() => {
    const loadAuthors = async () => {
      if (books.length === 0) return;
      
      setLoadingAuthors(true);
      const authorsMap = new Map<string, Author>();
      
      // Coletar autores únicos dos livros
      books.forEach(book => {
        if (book.autor) {
          const authors = book.autor.split(',').map(a => a.trim());
          authors.forEach(authorName => {
            if (authorName) {
              if (!authorsMap.has(authorName)) {
                authorsMap.set(authorName, {
                  id: authorName.toLowerCase().replace(/\s+/g, '-'),
                  nome: authorName,
                  foto: '',
                  livrosCount: 1
                });
              } else {
                authorsMap.get(authorName)!.livrosCount++;
              }
            }
          });
        }
      });
      
      // Buscar fotos para cada autor
      const authorsWithPhotos = await Promise.all(
        Array.from(authorsMap.values()).map(async (author) => {
          try {
            const authorWithPhoto = await getAuthorWithPhoto(author.nome);
            return { 
              ...author, 
              foto: authorWithPhoto.foto,
              livrosCount: author.livrosCount
            };
          } catch (error) {
            return author;
          }
        })
      );
      
      setAuthors(authorsWithPhotos);
      setLoadingAuthors(false);
    };
    
    loadAuthors();
  }, [books]);

  // Buscar livros do usuário (aprovados + emprestados) - ATUALIZADO
  useEffect(() => {
    const loadUserBooks = async () => {
      if (!user?.uid) {
        console.log('Usuário não logado');
        return;
      }
      
      setLoadingUserBooks(true);
      try {
        console.log('Carregando livros do usuário:', user.uid);
        const userBooksList = await getUserBooks(user.uid);
        console.log('Livros do usuário encontrados:', userBooksList.length);
        
        const userBooksData: MyBook[] = await Promise.all(
          userBooksList.map(async (reservation) => {
            console.log('Buscando metadados para livro:', reservation.bookId);
            const meta = await getBookMeta(reservation.bookId);
            console.log('Metadados encontrados:', meta);
            
            return {
              id: reservation.bookId,
              titulo: meta?.titulo || 'Livro emprestado',
              autor: meta?.autor || '—',
              capa: meta?.capa || 'https://via.placeholder.com/100x150?text=Livro',
              progresso: Math.floor(Math.random() * 100), // Progresso simulado
            };
          })
        );
        
        console.log('Livros mapeados:', userBooksData.length);
        setUserBooks(userBooksData);
      } catch (error) {
        console.error('Erro ao carregar livros do usuário:', error);
      } finally {
        setLoadingUserBooks(false);
      }
    };

    loadUserBooks();
  }, [user]);

  return (
    <SafeAreaProvider style={styles.conteiner}>
      <StatusBar style="dark" backgroundColor="#0d0d00"/>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Seção Meus Livros */}
        <View style={styles.sectionMyBooks}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Meus Livros</Text>
            <TouchableOpacity onPress={() => router.push('./meusLivros')}>
              <Text style={styles.seeAll}>Ver Tudo</Text>
            </TouchableOpacity>
          </View>
          {loadingUserBooks ? (
            <ActivityIndicator size="small" style={{ marginVertical: 20 }} />
          ) : userBooks.length > 0 ? (
            <FlatList
              data={userBooks}
              horizontal
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => router.push({ 
                    pathname: '/components/bookInfo', 
                    params: { id: item.id } 
                  })}
                  style={styles.bookItem}
                >
                  <Image
                    source={{ uri: item.capa || 'https://via.placeholder.com/130x195/01babf/ffffff?text=Sem+Capa' }}
                    style={styles.cover}
                  />
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum livro emprestado</Text>
              <Text style={styles.emptySubText}>Seus livros emprestados aparecerão aqui</Text>
            </View>
          )}
        </View>

        {/* Seção Autores */}
        <View style={styles.sectionAutors}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Autores</Text>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={styles.seeAll}>Ver Tudo</Text>
            </TouchableOpacity>
          </View>
          {loadingAuthors ? (
            <ActivityIndicator size="small" style={{ marginVertical: 20 }} />
          ) : authors.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.authorsContent}>
              {authors.map((author) => (
                <TouchableOpacity 
                  style={styles.authorItem} 
                  key={author.id}
                  onPress={() => router.push({ 
                    pathname: '/search', 
                    params: { authorId: author.id } 
                  })}
                >
                  <Image 
                    source={{ uri: author.foto || 'https://via.placeholder.com/70x70/cccccc/969696?text=?' }} 
                    style={styles.photo}
                  />
                  <Text style={styles.authorName} numberOfLines={2}>
                    {author.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum autor encontrado</Text>
            </View>
          )}
        </View>

        {/* Seção Para Você */}
        <View style={styles.sectionForYou}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Para Você</Text>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={styles.seeAll}>Ver Tudo</Text>
            </TouchableOpacity>
          </View>
          {loadingBooks ? (
            <ActivityIndicator size="small" style={{ marginVertical: 20 }} />
          ) : books.length > 0 ? (
            <FlatList
              data={books}
              horizontal
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => router.push({ 
                    pathname: '/components/bookInfo', 
                    params: { id: item.id } 
                  })}
                  style={styles.bookItem}
                >
                  <Image
                    source={{ uri: item.capa || 'https://via.placeholder.com/130x195/01babf/ffffff?text=Sem+Capa' }}
                    style={styles.cover}
                  />
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.flatListContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum livro disponível</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  conteiner:{
    flex: 1,
    backgroundColor: "#fff",
  },
  sectionMyBooks: {
    marginVertical: 8,
    minHeight: 250,
  },
  sectionAutors: {
    marginVertical: 8,
    minHeight: 150,
  },
  sectionForYou: {
    marginVertical: 8,
    minHeight: 250,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: 'gray',
    fontFamily: 'Poppins-Regular',
  },
  bookItem: {
    width: 150,
    marginHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  cover: { 
    width: 130, 
    height: 195, 
    borderRadius: 8, 
    backgroundColor: '#eee',
    marginBottom: 8,
  },
  authorItem: { 
    alignItems: 'center', 
    marginHorizontal: 12,
    width: 90,
  },
  photo: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#eee',
    marginBottom: 6,
  },
  authorName: { 
    fontSize: 11, 
    textAlign: 'center', 
    maxWidth: 80,
    fontFamily: 'Poppins-Bold',
    color: '#333',
    marginBottom: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    marginBottom: 4,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  flatListContent: {
    paddingHorizontal: 7,
  },
  authorsContent: {
    paddingHorizontal: 7,
  },
});