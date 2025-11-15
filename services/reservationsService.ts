// import { ref, push, set, get, onValue, off, query, orderByChild, remove, runTransaction } from 'firebase/database';
// import { auth, db } from '../firebase/config';

// export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'waiting' | 'returned';

// export interface Reservation {
//   id: string;
//   userId: string;
//   bookId: string;
//   status: ReservationStatus;
//   createdAt: number;
//   approvedAt?: number;
//   returnedAt?: number;
// }

// export interface BookMeta {
//   id: string;
//   titulo?: string;
//   capa?: string;
//   autor?: string;
// }

// export interface BookStatus {
//   available: boolean;
//   currentReservationId?: string;
//   queueCount: number;
//   currentLoan?: {
//     userId: string;
//     borrowedAt: number;
//     expectedReturn: number;
//   };
// }

// // Adicione esta interface no arquivo reservationsService.ts, antes da classe
// export interface WaitItem {
//   id: string;
//   reservaId: string;
//   bookId: string;
//   capa: string;
//   titulo?: string;
//   disponivelApos?: string;
//   status: string;
//   reservationStatus: string;
// }

// export async function reserveBook(bookId: string): Promise<string> {
//   const userId = auth.currentUser?.uid;
//   if (!userId) throw new Error('Usuário não autenticado');

//   console.log('ReservationsService: Iniciando reserva para bookId:', bookId, 'userId:', userId);

//   // Verifica se já existe alguma reserva ativa para este livro pelo usuário
//   const userResRef = ref(db, `userReservations/${userId}`);
//   const userResSnap = await get(userResRef);
//   if (userResSnap.exists()) {
//     const entries = Object.entries(userResSnap.val() as Record<string, boolean>);
//     for (const [reservationId] of entries) {
//       const rSnap = await get(ref(db, `reservations/${reservationId}`));
//       if (rSnap.exists()) {
//         const r = rSnap.val() as Omit<Reservation, 'id'>;
//         if (r.bookId === bookId && (r.status === 'pending' || r.status === 'waiting' || r.status === 'approved')) {
//           throw new Error('Você já possui uma reserva ativa para este livro');
//         }
//       }
//     }
//   }

//   const reservationsRef = ref(db, 'reservations');
//   const newRef = push(reservationsRef);
//   const reservation: Omit<Reservation, 'id'> = {
//     userId,
//     bookId,
//     status: 'pending',
//     createdAt: Date.now(),
//   };

//   console.log('ReservationsService: Salvando reserva:', newRef.key, reservation);
//   await set(newRef, reservation);
//   await set(ref(db, `userReservations/${userId}/${newRef.key}`), true);
//   await set(ref(db, `userBookReservations/${userId}/${bookId}`), newRef.key);

//   await set(ref(db, `bookQueues/${bookId}/${newRef.key}`), {
//     userId,
//     createdAt: reservation.createdAt,
//     status: 'pending',
//   });

//   await runTransaction(ref(db, `bookStatus/${bookId}`), (current: any) => {
//     const next = current || { available: true, currentReservationId: null, queueCount: 0 };
//     next.queueCount = (next.queueCount || 0) + 1;
//     return next;
//   });

//   const notifRef = push(ref(db, 'notifications'));
//   await set(notifRef, {
//     type: 'reservation_created',
//     reservationId: newRef.key,
//     bookId,
//     userId,
//     status: 'unread',
//     createdAt: reservation.createdAt,
//   });

//   console.log('ReservationsService: Reserva criada com sucesso:', newRef.key);
//   return newRef.key as string;
// }

// export function listenUserReservations(
//   userId: string,
//   onChange: (reservations: Reservation[]) => void
// ) {
//   const q = query(ref(db, 'reservations'), orderByChild('userId'));
//   const handler = onValue(q, (snap) => {
//     const list: Reservation[] = [];
//     snap.forEach((child) => {
//       const val = child.val();
//       if (val.userId === userId) {
//         list.push({ id: child.key as string, ...val });
//       }
//     });
//     onChange(list.sort((a, b) => b.createdAt - a.createdAt));
//   });
//   return () => off(q, 'value', handler);
// }

// export async function getUserApprovedReservations(userId: string): Promise<Reservation[]> {
//   const q = query(ref(db, 'reservations'), orderByChild('userId'));
//   const snap = await get(q);
//   const list: Reservation[] = [];
//   snap.forEach((child) => {
//     const val = child.val();
//     if (val.userId === userId && val.status === 'approved') {
//       list.push({ id: child.key as string, ...val });
//     }
//   });
//   return list.sort((a, b) => b.createdAt - a.createdAt);
// }

// export function listenUserReservationsByStatus(
//   userId: string,
//   statuses: ReservationStatus[],
//   onChange: (reservations: Reservation[]) => void
// ) {
//   const q = query(ref(db, 'reservations'), orderByChild('userId'));
//   const handler = onValue(q, (snap) => {
//     console.log('ReservationsService: listener disparado para userId:', userId, 'statuses:', statuses);
//     const setStatuses = new Set(statuses);
//     const out: Reservation[] = [];
//     snap.forEach((child) => {
//       const val = child.val();
//       console.log('ReservationsService: verificando reserva:', child.key, 'userId:', val.userId, 'status:', val.status);
//       if (val.userId === userId && setStatuses.has(val.status)) {
//         out.push({ id: child.key as string, ...val });
//       }
//     });
//     console.log('ReservationsService: reservas encontradas:', out.length);
//     onChange(out.sort((a, b) => b.createdAt - a.createdAt));
//   });
//   return () => off(q, 'value', handler);
// }

// export async function markNotificationRead(notificationId: string): Promise<void> {
//   await set(ref(db, `notifications/${notificationId}/status`), 'read');
// }

// export async function cancelReservation(reservationId: string): Promise<void> {
//   const userId = auth.currentUser?.uid;
//   if (!userId) throw new Error('Usuário não autenticado');
//   const resRef = ref(db, `reservations/${reservationId}`);
//   const snap = await get(resRef);
//   if (!snap.exists()) throw new Error('Reserva não encontrada');
//   const r = snap.val() as Omit<Reservation, 'id'>;
//   if (r.userId !== userId) throw new Error('Você não pode cancelar esta reserva');

//   await remove(ref(db, `userReservations/${userId}/${reservationId}`));
//   await remove(ref(db, `bookQueues/${r.bookId}/${reservationId}`));
//   await remove(ref(db, `userBookReservations/${userId}/${r.bookId}`));
//   await remove(resRef);

//   await runTransaction(ref(db, `bookStatus/${r.bookId}`), (current: any) => {
//     const next = current || { available: true, currentReservationId: null, queueCount: 0 };
//     next.queueCount = Math.max(0, (next.queueCount || 0) - 1);
//     return next;
//   });

//   const notifRef = push(ref(db, 'notifications'));
//   await set(notifRef, {
//     type: 'reservation_cancelled',
//     reservationId,
//     bookId: r.bookId,
//     userId,
//     status: 'unread',
//     createdAt: Date.now(),
//   });
// }

// export async function getBookMeta(bookId: string): Promise<BookMeta | null> {
//   const bookRef = ref(db, `livros/${bookId}`);
//   const snap = await get(bookRef);
//   if (!snap.exists()) return null;
//   const v = snap.val();
//   return { id: bookId, titulo: v.titulo, capa: v.capa, autor: v.autor };
// }

// export async function getBookStatus(bookId: string): Promise<BookStatus | null> {
//   const statusRef = ref(db, `bookStatus/${bookId}`);
//   const snap = await get(statusRef);
//   if (!snap.exists()) return null;
//   return snap.val() as BookStatus;
// }

// export function listenIsBookReservedByUser(
//   bookId: string,
//   onChange: (reserved: boolean) => void
// ) {
//   const userId = auth.currentUser?.uid;
//   if (!userId) {
//     onChange(false);
//     return () => {};
//   }
//   const markerRef = ref(db, `userBookReservations/${userId}/${bookId}`);
//   const handler = onValue(markerRef, (snap) => {
//     onChange(snap.exists());
//   });
//   return () => off(markerRef, 'value', handler);
// }

// // Nova função para calcular data de disponibilidade prevista
// export async function getExpectedAvailability(bookId: string): Promise<string> {
//   try {
//     const bookStatus = await getBookStatus(bookId);
    
//     if (!bookStatus) {
//       return 'Disponível';
//     }
    
//     // Se o livro está disponível
//     if (bookStatus.available) {
//       return 'Disponível agora';
//     }
    
//     // Se há um empréstimo ativo, calcular data de devolução
//     if (bookStatus.currentLoan) {
//       const expectedReturnDate = new Date(bookStatus.currentLoan.expectedReturn);
//       return `Disponível em ${expectedReturnDate.toLocaleDateString('pt-BR')}`;
//     }
    
//     // Se está reservado mas não emprestado
//     return 'Em breve';
    
//   } catch (error) {
//     console.error('Erro ao calcular disponibilidade:', error);
//     return 'Indisponível';
//   }
// }

// // Função para obter status legível do livro
// export function getBookStatusText(status: BookStatus): string {
//   if (status.available) {
//     return 'Disponível';
//   }
  
//   if (status.currentLoan) {
//     return 'Emprestado';
//   }
  
//   if (status.queueCount > 0) {
//     return 'Reservado';
//   }
  
//   return 'Indisponível';
// }

// // Adicione esta função no final do arquivo reservationsService.ts
// export function listenUserReservationsWithMeta(
//   userId: string,
//   statuses: ReservationStatus[],
//   onChange: (reservations: WaitItem[]) => void
// ) {
//   const q = query(ref(db, 'reservations'), orderByChild('userId'));
  
//   const handler = onValue(q, async (snap) => {
//     const setStatuses = new Set(statuses);
//     const out: WaitItem[] = [];
    
//     const promises: Promise<void>[] = [];
    
//     snap.forEach((child) => {
//       const val = child.val();
//       if (val.userId === userId && setStatuses.has(val.status)) {
//         const promise = (async () => {
//           try {
//             const meta = await getBookMeta(val.bookId);
//             const disponibilidade = await getExpectedAvailability(val.bookId);
//             const bookStatus = await getBookStatus(val.bookId);
//             const statusText = bookStatus ? getBookStatusText(bookStatus) : 'Pendente';
            
//             out.push({
//               reservaId: child.key!,
//               bookId: val.bookId,
//               titulo: meta?.titulo,
//               capa: meta?.capa || 'https://via.placeholder.com/80x110?text=Livro',
//               id: child.key!,
//               disponivelApos: disponibilidade,
//               status: statusText,
//               reservationStatus: val.status
//             });
//           } catch (error) {
//             console.error('Erro ao carregar metadados do livro:', error);
//           }
//         })();
//         promises.push(promise);
//       }
//     });
    
//     await Promise.all(promises);
//     onChange(out.sort((a, b) => b.reservaId.localeCompare(a.reservaId)));
//   });

//   return () => off(q, 'value', handler);
// }

import { ref, push, set, get, onValue, off, query, orderByChild, remove, runTransaction } from 'firebase/database';
import { auth, db } from '../firebase/config';

// Use status em português e inglês para compatibilidade
export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'waiting' | 'returned' | 'pendente' | 'aprovada' | 'rejeitada' | 'aguardando' | 'devolvida';

export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  status: ReservationStatus;
  createdAt: number;
  approvedAt?: number;
  returnedAt?: number;
}

export interface BookMeta {
  id: string;
  titulo?: string;
  capa?: string;
  autor?: string;
}

export interface BookStatus {
  available: boolean;
  currentReservationId?: string;
  queueCount: number;
  currentLoan?: {
    userId: string;
    borrowedAt: number;
    expectedReturn: number;
  };
}

export interface WaitItem {
  id: string;
  reservaId: string;
  bookId: string;
  capa: string;
  titulo?: string;
  disponivelApos?: string;
  status: string;
  reservationStatus: string;
}

export async function reserveBook(bookId: string): Promise<string> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Usuário não autenticado');

  console.log('ReservationsService: Iniciando reserva para bookId:', bookId, 'userId:', userId);

  // Verifica se já existe alguma reserva ativa para este livro pelo usuário
  const userResRef = ref(db, `userReservations/${userId}`);
  const userResSnap = await get(userResRef);
  if (userResSnap.exists()) {
    const entries = Object.entries(userResSnap.val() as Record<string, boolean>);
    for (const [reservationId] of entries) {
      const rSnap = await get(ref(db, `reservations/${reservationId}`));
      if (rSnap.exists()) {
        const r = rSnap.val() as Omit<Reservation, 'id'>;
        if (r.bookId === bookId && (r.status === 'pending' || r.status === 'pendente' || r.status === 'waiting' || r.status === 'aguardando' || r.status === 'approved' || r.status === 'aprovada')) {
          throw new Error('Você já possui uma reserva ativa para este livro');
        }
      }
    }
  }

  const reservationsRef = ref(db, 'reservations');
  const newRef = push(reservationsRef);
  const reservation: Omit<Reservation, 'id'> = {
    userId,
    bookId,
    status: 'pending', // Status em inglês para compatibilidade
    createdAt: Date.now(),
  };

  console.log('ReservationsService: Salvando reserva:', newRef.key, reservation);
  await set(newRef, reservation);
  await set(ref(db, `userReservations/${userId}/${newRef.key}`), true);
  await set(ref(db, `userBookReservations/${userId}/${bookId}`), newRef.key);

  await set(ref(db, `bookQueues/${bookId}/${newRef.key}`), {
    userId,
    createdAt: reservation.createdAt,
    status: 'pending',
  });

  await runTransaction(ref(db, `bookStatus/${bookId}`), (current: any) => {
    const next = current || { available: true, currentReservationId: null, queueCount: 0 };
    next.queueCount = (next.queueCount || 0) + 1;
    return next;
  });

  const notifRef = push(ref(db, 'notifications'));
  await set(notifRef, {
    type: 'reservation_created',
    reservationId: newRef.key,
    bookId,
    userId,
    status: 'unread',
    createdAt: reservation.createdAt,
  });

  console.log('ReservationsService: Reserva criada com sucesso:', newRef.key);
  return newRef.key as string;
}

// Função corrigida para buscar reservas aprovadas - busca em português e inglês
export async function getUserApprovedReservations(userId: string): Promise<Reservation[]> {
  try {
    console.log('Buscando reservas aprovadas para usuário:', userId);
    
    // Tenta buscar de 'reservations' (inglês) primeiro
    let q = query(ref(db, 'reservations'), orderByChild('userId'));
    let snap = await get(q);
    
    // Se não encontrar em 'reservations', tenta em 'reservas' (português)
    if (!snap.exists() || snap.size === 0) {
      console.log('Nenhuma reserva encontrada em "reservations", tentando "reservas"');
      q = query(ref(db, 'reservas'), orderByChild('userId'));
      snap = await get(q);
    }

    const list: Reservation[] = [];
    
    if (snap.exists()) {
      snap.forEach((child) => {
        const val = child.val();
        console.log('Reserva encontrada:', child.key, 'status:', val.status, 'userId:', val.userId);
        
        // Verifica se a reserva pertence ao usuário E tem status aprovado (em português ou inglês)
        if (val.userId === userId && (val.status === 'aprovada' || val.status === 'approved')) {
          list.push({ 
            id: child.key as string, 
            ...val 
          });
        }
      });
    }
    
    console.log('Total de reservas aprovadas encontradas:', list.length);
    return list.sort((a, b) => b.createdAt - a.createdAt);
    
  } catch (error) {
    console.error('Erro ao buscar reservas aprovadas:', error);
    return [];
  }
}

// Função para buscar todos os livros do usuário (aprovados + emprestados)
export async function getUserBooks(userId: string): Promise<Reservation[]> {
  try {
    console.log('🔍 getUserBooks: Buscando todos os livros do usuário:', userId);
    
    const list: Reservation[] = [];
    const addedBookIds = new Set<string>(); // Para evitar duplicações
    
    // 1. Buscar de 'reservations' (inglês) - SEM orderByChild para evitar problemas de índice
    try {
      console.log('📋 Buscando em reservations...');
      const reservationsRef = ref(db, 'reservations');
      const snap1 = await get(reservationsRef);
      
      if (snap1.exists()) {
        console.log('📋 Reservations encontradas:', snap1.size);
        snap1.forEach((child) => {
          const val = child.val();
          console.log('📋 Reservation:', child.key, 'status:', val.status, 'userId:', val.userId, 'bookId:', val.bookId);
          
          if (val.userId === userId && 
              (val.status === 'aprovada' || val.status === 'approved' || 
               val.status === 'emprestado' || val.status === 'borrowed')) {
            
            // Verificar se já foi adicionado
            if (!addedBookIds.has(val.bookId)) {
              console.log('✅ Reservation incluída:', child.key);
              addedBookIds.add(val.bookId);
              list.push({ 
                id: child.key as string, 
                ...val 
              });
            } else {
              console.log('⚠️ Reservation duplicada ignorada:', child.key);
            }
          }
        });
      } else {
        console.log('📋 Nenhuma reservation encontrada');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar de reservations:', error);
    }
    
    // 2. Buscar de 'reservas' (português) - SEM orderByChild para evitar problemas de índice
    try {
      console.log('📋 Buscando em reservas...');
      const reservasRef = ref(db, 'reservas');
      const snap2 = await get(reservasRef);
      
      if (snap2.exists()) {
        console.log('📋 Reservas encontradas:', snap2.size);
        snap2.forEach((child) => {
          const val = child.val();
          console.log('📋 Reserva:', child.key, 'status:', val.status, 'userId:', val.userId, 'bookId:', val.bookId);
          
          if (val.userId === userId && 
              (val.status === 'aprovada' || val.status === 'approved' || 
               val.status === 'emprestado' || val.status === 'borrowed')) {
            
            // Verificar se já foi adicionado
            if (!addedBookIds.has(val.bookId)) {
              console.log('✅ Reserva incluída:', child.key);
              addedBookIds.add(val.bookId);
              list.push({ 
                id: child.key as string, 
                ...val 
              });
            } else {
              console.log('⚠️ Reserva duplicada ignorada:', child.key);
            }
          }
        });
      } else {
        console.log('📋 Nenhuma reserva encontrada');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar de reservas:', error);
    }
    
    // 3. Buscar de 'emprestimos' (tabela separada para empréstimos ativos) - SEM orderByChild para evitar problemas de índice
    try {
      console.log('📚 Buscando em emprestimos...');
      const emprestimosRef = ref(db, 'emprestimos');
      const snap3 = await get(emprestimosRef);
      
      if (snap3.exists()) {
        console.log('📚 Empréstimos encontrados:', snap3.size);
        snap3.forEach((child) => {
          const val = child.val();
          const bookId = val.bookId || val.livroId;
          console.log('📚 Empréstimo:', child.key, 'status:', val.status, 'userId:', val.userId, 'bookId:', bookId);
          
          if (val.userId === userId && 
              (val.status === 'emprestado' || val.status === 'atrasado' || 
               val.status === 'borrowed' || val.status === 'overdue')) {
            
            // Verificar se já foi adicionado
            if (!addedBookIds.has(bookId)) {
              console.log('✅ Empréstimo incluído:', child.key);
              addedBookIds.add(bookId);
              list.push({ 
                id: child.key as string, 
                bookId: bookId,
                userId: val.userId,
                status: val.status,
                createdAt: val.createdAt || val.dataEmprestimo || Date.now()
              });
            } else {
              console.log('⚠️ Empréstimo duplicado ignorado:', child.key);
            }
          }
        });
      } else {
        console.log('📚 Nenhum empréstimo encontrado');
      }
    } catch (error) {
      console.log('❌ Erro ao buscar de emprestimos:', error);
    }
    
    console.log('📊 Total de livros do usuário encontrados:', list.length);
    console.log('📊 Lista final:', list.map(item => ({ id: item.id, bookId: item.bookId, status: item.status })));
    return list.sort((a, b) => b.createdAt - a.createdAt);
    
  } catch (error) {
    console.error('❌ Erro ao buscar livros do usuário:', error);
    return [];
  }
}

// Função para escutar reservas do usuário
export function listenUserReservations(
  userId: string,
  onChange: (reservations: Reservation[]) => void
) {
  // Tenta 'reservations' primeiro, depois 'reservas'
  const q = query(ref(db, 'reservations'), orderByChild('userId'));
  const handler = onValue(q, (snap) => {
    const list: Reservation[] = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val.userId === userId) {
        list.push({ id: child.key as string, ...val });
      }
    });
    onChange(list.sort((a, b) => b.createdAt - a.createdAt));
  });
  return () => off(q, 'value', handler);
}

// Função corrigida para escutar reservas por status - busca em português e inglês
export function listenUserReservationsByStatus(
  userId: string,
  statuses: ReservationStatus[],
  onChange: (reservations: Reservation[]) => void
) {
  console.log('Escutando reservas para userId:', userId, 'statuses:', statuses);
  
  // Tenta buscar de 'reservations' primeiro
  const q = query(ref(db, 'reservations'), orderByChild('userId'));
  
  const handler = onValue(q, (snap) => {
    console.log('Dados recebidos do Firebase, total:', snap.size);
    const setStatuses = new Set(statuses);
    const out: Reservation[] = [];
    
    snap.forEach((child) => {
      const val = child.val();
      console.log('Verificando reserva:', child.key, 'userId:', val.userId, 'status:', val.status);
      
      if (val.userId === userId && setStatuses.has(val.status)) {
        console.log('Reserva incluída:', child.key);
        out.push({ 
          id: child.key as string, 
          ...val 
        });
      }
    });
    
    console.log('Reservas filtradas encontradas:', out.length);
    onChange(out.sort((a, b) => b.createdAt - a.createdAt));
  });

  return () => off(q, 'value', handler);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await set(ref(db, `notifications/${notificationId}/status`), 'read');
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Usuário não autenticado');
  
  console.log('🔄 cancelReservation: Iniciando cancelamento da reserva:', reservationId);
  
  // Tenta cancelar de 'reservations' primeiro
  let resRef = ref(db, `reservations/${reservationId}`);
  let snap = await get(resRef);
  
  // Se não encontrar em 'reservations', tenta em 'reservas'
  if (!snap.exists()) {
    console.log('📋 Reserva não encontrada em "reservations", tentando "reservas"');
    resRef = ref(db, `reservas/${reservationId}`);
    snap = await get(resRef);
  }
  
  if (!snap.exists()) throw new Error('Reserva não encontrada');
  const r = snap.val() as Omit<Reservation, 'id'>;
  if (r.userId !== userId) throw new Error('Você não pode cancelar esta reserva');

  console.log('🗑️ Removendo referências da reserva...');
  
  // Executar remoções em paralelo para melhor performance
  await Promise.all([
    remove(ref(db, `userReservations/${userId}/${reservationId}`)),
    remove(ref(db, `bookQueues/${r.bookId}/${reservationId}`)),
    remove(ref(db, `userBookReservations/${userId}/${r.bookId}`)),
    remove(resRef)
  ]);

  console.log('📊 Atualizando status do livro...');
  await runTransaction(ref(db, `bookStatus/${r.bookId}`), (current: any) => {
    const next = current || { available: true, currentReservationId: null, queueCount: 0 };
    next.queueCount = Math.max(0, (next.queueCount || 0) - 1);
    return next;
  });

  console.log('📧 Criando notificação...');
  const notifRef = push(ref(db, 'notifications'));
  await set(notifRef, {
    type: 'reservation_cancelled',
    reservationId,
    bookId: r.bookId,
    userId,
    status: 'unread',
    createdAt: Date.now(),
  });
  
  console.log('✅ cancelReservation: Reserva cancelada com sucesso');
}

export async function getBookMeta(bookId: string): Promise<BookMeta | null> {
  try {
    // Tenta buscar de 'livros' primeiro
    const bookRef = ref(db, `livros/${bookId}`);
    const snap = await get(bookRef);
    
    if (snap.exists()) {
      const v = snap.val();
      return { id: bookId, titulo: v.titulo, capa: v.capa, autor: v.autor };
    }
    
    // Se não encontrar, tenta em 'books'
    console.log('Livro não encontrado em livros/, tentando books/');
    const bookRef2 = ref(db, `books/${bookId}`);
    const snap2 = await get(bookRef2);
    
    if (snap2.exists()) {
      const v = snap2.val();
      return { 
        id: bookId, 
        titulo: v.title || v.titulo, 
        capa: v.thumbnail || v.capa || v.imageUrl, 
        autor: v.author || v.autor 
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar metadados do livro:', error);
    return null;
  }
}

export async function getBookStatus(bookId: string): Promise<BookStatus | null> {
  const statusRef = ref(db, `bookStatus/${bookId}`);
  const snap = await get(statusRef);
  if (!snap.exists()) return null;
  return snap.val() as BookStatus;
}

export function listenIsBookReservedByUser(
  bookId: string,
  onChange: (reserved: boolean) => void
) {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    onChange(false);
    return () => {};
  }
  const markerRef = ref(db, `userBookReservations/${userId}/${bookId}`);
  const handler = onValue(markerRef, (snap) => {
    onChange(snap.exists());
  });
  return () => off(markerRef, 'value', handler);
}

export async function getExpectedAvailability(bookId: string): Promise<string> {
  try {
    const bookStatus = await getBookStatus(bookId);
    
    if (!bookStatus) {
      return 'Disponível';
    }
    
    if (bookStatus.available) {
      return 'Disponível agora';
    }
    
    if (bookStatus.currentLoan) {
      const expectedReturnDate = new Date(bookStatus.currentLoan.expectedReturn);
      return `Disponível em ${expectedReturnDate.toLocaleDateString('pt-BR')}`;
    }
    
    return 'Em breve';
    
  } catch (error) {
    console.error('Erro ao calcular disponibilidade:', error);
    return 'Indisponível';
  }
}

export function getBookStatusText(status: BookStatus): string {
  if (status.available) {
    return 'Disponível';
  }
  
  if (status.currentLoan) {
    return 'Emprestado';
  }
  
  if (status.queueCount > 0) {
    return 'Reservado';
  }
  
  return 'Indisponível';
}

export function listenUserReservationsWithMeta(
  userId: string,
  statuses: ReservationStatus[],
  onChange: (reservations: WaitItem[]) => void
) {
  const q = query(ref(db, 'reservations'), orderByChild('userId'));
  
  const handler = onValue(q, async (snap) => {
    const setStatuses = new Set(statuses);
    const out: WaitItem[] = [];
    
    const promises: Promise<void>[] = [];
    
    snap.forEach((child) => {
      const val = child.val();
      if (val.userId === userId && setStatuses.has(val.status)) {
        const promise = (async () => {
          try {
            const meta = await getBookMeta(val.bookId);
            const disponibilidade = await getExpectedAvailability(val.bookId);
            const bookStatus = await getBookStatus(val.bookId);
            const statusText = bookStatus ? getBookStatusText(bookStatus) : 'Pendente';
            
            out.push({
              reservaId: child.key!,
              bookId: val.bookId,
              titulo: meta?.titulo,
              capa: meta?.capa || 'https://via.placeholder.com/80x110?text=Livro',
              id: child.key!,
              disponivelApos: disponibilidade,
              status: statusText,
              reservationStatus: val.status
            });
          } catch (error) {
            console.error('Erro ao carregar metadados do livro:', error);
          }
        })();
        promises.push(promise);
      }
    });
    
    await Promise.all(promises);
    onChange(out.sort((a, b) => b.reservaId.localeCompare(a.reservaId)));
  });

  return () => off(q, 'value', handler);
}