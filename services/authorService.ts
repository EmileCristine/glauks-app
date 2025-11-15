// services/authorService.ts
import { ref, set, get } from 'firebase/database';
import { db } from '../firebase/config';

export interface Author {
  id: string;
  nome: string;
  foto: string;
  livrosCount: number;
  biografia?: string;
  dataCriacao?: string;
}

export const searchAuthorPhoto = async (authorName: string): Promise<string> => {
  try {
    // Tentar Wikipedia API
    const wikiResponse = await fetch(
      `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(authorName)}`
    );
    
    if (wikiResponse.ok) {
      const data = await wikiResponse.json();
      if (data.thumbnail) {
        return data.thumbnail.source;
      }
    }
    
    // Fallback: Google Books API
    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=inauthor:"${encodeURIComponent(authorName)}"&maxResults=1`
    );
    
    if (googleResponse.ok) {
      const data = await googleResponse.json();
      if (data.items && data.items[0].volumeInfo.imageLinks) {
        return data.items[0].volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
      }
    }
    
    // Último fallback: avatar personalizado
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&size=200&background=01babf&color=fff&bold=true`;
    
  } catch (error) {
    console.error('Erro ao buscar foto do autor:', error);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&size=200&background=01babf&color=fff&bold=true`;
  }
};

export const getAuthorWithPhoto = async (authorName: string): Promise<Author> => {
  const authorId = authorName.toLowerCase().replace(/\s+/g, '-');
  const authorRef = ref(db, `autores/${authorId}`);
  
  try {
    // Verificar se já existe no Firebase
    const snapshot = await get(authorRef);
    
    if (snapshot.exists()) {
      return { id: authorId, ...snapshot.val() };
    }
    
    // Se não existe, buscar foto e salvar
    const foto = await searchAuthorPhoto(authorName);
    const authorData = {
      nome: authorName,
      foto: foto,
      livrosCount: 1,
      dataCriacao: new Date().toISOString()
    };
    
    // Salvar no Firebase para cache
    await set(authorRef, authorData);
    
    return { id: authorId, ...authorData };
    
  } catch (error) {
    console.error('Erro ao buscar autor:', error);
    return {
      id: authorId,
      nome: authorName,
      foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&size=200&background=01babf&color=fff`,
      livrosCount: 1,
      dataCriacao: new Date().toISOString()
    };
  }
};

export const syncAuthorsToFirebase = async (books: any[]): Promise<void> => {
  try {
    const authorsMap = new Map();
    
    books.forEach(book => {
      if (book.autor) {
        const authors = book.autor.split(',').map((a: string) => a.trim());
        authors.forEach((authorName: string) => {
          if (authorName) {
            if (!authorsMap.has(authorName)) {
              authorsMap.set(authorName, {
                nome: authorName,
                livrosCount: 1,
                livros: [book.titulo]
              });
            } else {
              const author = authorsMap.get(authorName);
              author.livrosCount++;
              author.livros.push(book.titulo);
            }
          }
        });
      }
    });
    
    // Salvar autores no Firebase
    for (const [authorName, authorData] of authorsMap) {
      // Limpar caracteres especiais que causam problemas no Firebase
      const authorId = authorName
        .toLowerCase()
        .replace(/[.#$[\]]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .replace(/[^a-z0-9-]/g, ''); // Remove qualquer caractere que não seja letra, número ou hífen
      
      const authorRef = ref(db, `autores/${authorId}`);
      
      const existingSnapshot = await get(authorRef);
      if (!existingSnapshot.exists()) {
        const foto = await searchAuthorPhoto(authorName);
        await set(authorRef, {
          ...authorData,
          foto: foto,
          dataCriacao: new Date().toISOString()
        });
      }
    }
    
    console.log('Autores sincronizados com sucesso!');
  } catch (error) {
    console.error('Erro ao sincronizar autores:', error);
  }
};