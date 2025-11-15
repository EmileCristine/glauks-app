import { useRouter } from 'expo-router'
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ref, onValue, off } from 'firebase/database'
import { db } from '../../firebase/config'
import Header from "../components/header"
import SearchBar from "../components/searchBar"

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

const FILTERS = ['Suspense', 'Romance', 'Fantasia','Ficção', 'Ficção Científica', 'Terror']

export default function Search() {
  const { width: screenWidth } = useWindowDimensions()
  const minItemWidth = 110
  const horizontalPadding = 20

  const numColumns = Math.floor((screenWidth - horizontalPadding) / minItemWidth)
  const coverSize = (screenWidth - horizontalPadding - numColumns * 10) / numColumns

  const [books, setBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Buscar todos os livros do Firebase
  useEffect(() => {
    setLoading(true)

    const booksRef = ref(db, 'livros')

    const callback = (snapshot: any) => {
      if (snapshot.exists()) {
        const booksData: Book[] = []
        snapshot.forEach((childSnapshot: any) => {
          booksData.push({
            id: childSnapshot.key!,
            ...childSnapshot.val()
          });
        });
        setBooks(booksData);
        setFilteredBooks(booksData.slice(0, 15))
      }
      setLoading(false);
    };

    onValue(booksRef, callback)

    return () => off(booksRef, 'value', callback)
  }, []);

  // Filtrar livros por gênero
  useEffect(() => {
    if (!searchQuery && books.length > 0) {
      const filtered = books.filter(book =>
        book.genero && book.genero.toLowerCase().includes(selectedFilter.toLowerCase())
      );
      setFilteredBooks(filtered.slice(0, 15))
    }
  }, [selectedFilter, books, searchQuery])

  // Buscar livros no Firebase
  const searchBooksInFirebase = async (query: string): Promise<Book[]> => {
    return new Promise((resolve) => {
      const booksRef = ref(db, 'livros')

      const callback = (snapshot: any) => {
        if (snapshot.exists()) {
          const booksData: Book[] = []
          snapshot.forEach((childSnapshot: any) => {
            const book = childSnapshot.val()
            const bookData = {
              id: childSnapshot.key!,
              ...book
            };

            const searchLower = query.toLowerCase();
            if (book.titulo?.toLowerCase().includes(searchLower) ||
                book.autor?.toLowerCase().includes(searchLower) ||
                book.genero?.toLowerCase().includes(searchLower) ||
                book.isbn?.includes(query)) {
              booksData.push(bookData)
            }
          });

          resolve(booksData)
        } else {
          resolve([])
        }
        off(booksRef, 'value', callback)
      };

      onValue(booksRef, callback, { onlyOnce: true })
    })
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    setIsSearching(false)
    setLoading(true)

    if (query.trim() && !searchHistory.includes(query)) {
      setSearchHistory((prev) => [query, ...prev.slice(0, 9)])
    }

    if (query.trim() === '') {
      const filtered = books.filter(book =>
        book.genero && book.genero.toLowerCase().includes(selectedFilter.toLowerCase())
      );
      setFilteredBooks(filtered.slice(0, 15))
    } else {
      const results = await searchBooksInFirebase(query)
      setFilteredBooks(results.slice(0, 15))
    }

    setLoading(false)
  }

  const handleClear = () => {
    setSearchQuery('')
    setIsSearching(false)
    setLoading(true)

    const filtered = books.filter(book =>
      book.genero && book.genero.toLowerCase().includes(selectedFilter.toLowerCase())
    );
    setFilteredBooks(filtered.slice(0, 15))
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Header />

      <SearchBar
        value={searchQuery}
        onSearch={handleSearch}
        onClear={handleClear}
        onFocus={() => setIsSearching(true)}
        placeholder="Pesquisar por título, autor ou gênero..."
      />

      {!searchQuery && !isSearching && (
        <>
          <Image
            source={require('../../assets/images/banner.jpeg')}
            style={styles.banner}
            resizeMode="cover"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            {FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filter,
                  selectedFilter === filter && { backgroundColor: '#01babf' }
                ]}
                onPress={() => {
                  setSelectedFilter(filter)
                  setSearchQuery('')
                }}
              >
                <Text style={[
                  styles.filterText,
                  selectedFilter === filter && { color: '#fff', fontWeight: 'bold' }
                ]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {isSearching ? (
        <ScrollView style={{ paddingHorizontal: 15, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
              Histórico de buscas
            </Text>
            {searchHistory.length > 0 && (
              <TouchableOpacity onPress={() => setSearchHistory([])}>
                <Text style={{ color: '#01babf', fontWeight: 'bold' }}>Limpar histórico</Text>
              </TouchableOpacity>
            )}
          </View>

          {searchHistory.length === 0 ? (
            <Text style={{ color: '#aaa' }}>Nenhuma busca recente.</Text>
          ) : (
            searchHistory.map((term, index) => (
              <TouchableOpacity key={index} onPress={() => handleSearch(term)}>
                <Text style={{ paddingVertical: 8, fontSize: 15 }}>{term}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : loading ? (
        <ActivityIndicator size="large" style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredBooks}
          keyExtractor={item => item.id}
          numColumns={searchQuery ? 1 : numColumns}
          contentContainerStyle={styles.booksGrid}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/components/bookInfo', params: { id: item.id } })}
            >
              <View style={[
                searchQuery ? styles.bookListItem : {
                  width: coverSize,
                  margin: 5,
                  alignItems: 'center',
                }
              ]}>
                <Image
                  source={{ uri: item.capa || 'https://via.placeholder.com/150x200/01babf/ffffff?text=Sem+Capa' }}
                  style={[
                    searchQuery
                      ? styles.bookCoverList
                      : {
                          width: coverSize,
                          height: coverSize * 1.5,
                          borderRadius: 10,
                          backgroundColor: '#eee',
                        }
                  ]}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                {searchQuery && (
                  <View style={styles.bookInfo}>
                    <Text style={styles.bookTitleList}>{item.titulo}</Text>
                    <Text style={styles.bookAuthorList}>{item.autor}</Text>
                    <Text style={styles.bookGenreList}>{item.genero}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nenhum livro encontrado' : 'Nenhum livro disponível'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{
    flex: 1,
    backgroundColor: "#fff",
  },
  banner: {
    width: '90%',
    height: 100,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  filters: {
    flexDirection: 'row',
    marginTop: 5,
    marginLeft: 15,
    maxHeight: 35,
    minHeight: 35,
    paddingBottom: 5,
  },
  filter: {
    backgroundColor: '#f7f7f7',
    height: '100%',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginRight: 10,
  },
  filterText: {
    color: '#bbb',
    fontWeight: '600',
    fontSize: 13,
  },
  booksGrid: {
    paddingBottom: 15,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  bookListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
  },
  bookCoverList: {
    width: 60,
    height: 90,
    marginRight: 15,
    borderRadius: 5,
    backgroundColor: '#eee',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitleList: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  bookAuthorList: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  bookGenreList: {
    fontSize: 11,
    color: '#01babf',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
})