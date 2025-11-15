export async function searchBooks(query: string): Promise<any[]> {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=30`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      return data.items || [];
    } catch (error) {
      console.error('Error searching books:', error);
      return [];
    }
  }
  
  export async function getBookById(id: string): Promise<any> {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      return await res.json();
    } catch (error) {
      console.error('Error fetching book by ID:', error);
      throw error; // Ou retorne null/undefined dependendo do seu caso de uso
    }
  }