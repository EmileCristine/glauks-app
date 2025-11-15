import { StyleSheet, View, TouchableOpacity, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';

interface SearchBarProps {
  value?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  onFocus?: () => void;
  placeholder?: string;
}

export default function SearchBar({ value = '', onSearch, onClear, onFocus, placeholder }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    if (onClear) onClear();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          enablesReturnKeyAutomatically={true}
          underlineColorAndroid="transparent"
          onFocus={() => {
            setIsFocused(true);
            if (onFocus) onFocus();
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    marginHorizontal: 5,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchContainerFocused: {
    backgroundColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 30,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 0,
  },
});
