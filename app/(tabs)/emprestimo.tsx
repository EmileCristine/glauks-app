import { StyleSheet, Text, View, Image, ScrollView, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import Header from "../components/header";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { auth, db } from "../../firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";
import { ref, onValue, off, get, query, orderByChild } from "firebase/database";
import { 
  Reservation, 
  getBookMeta, 
  cancelReservation,
  getBookStatus,
  getBookStatusText,
} from "../../services/reservationsService";

type PendingLoan = { 
  id: string; 
  capa: string; 
  titulo?: string; 
  dataDevolucao?: string;
  status: string;
  createdAt: number;
};

type WaitItem = { 
  id: string; 
  reservaId: string; 
  bookId: string; 
  capa: string; 
  titulo?: string; 
  disponivelApos?: string;
  status: string;
  reservationStatus: string;
  positionInQueue: number;
  createdAt: number;
};

type OverdueLoan = {
  id: string;
  reservaId: string;
  bookId: string;
  capa: string;
  titulo?: string;
  dataDevolucaoEsperada: string;
  diasAtraso: number;
  createdAt: number;
};

interface BookStatus {
  available: boolean;
  currentReservationId?: string;
  queueCount: number;
  currentLoan?: {
    userId: string;
    borrowedAt: number;
    expectedReturn: number;
  };
}

// Função para escutar reservas por status - escuta em 'reservas' e 'reservations'
const listenUserReservationsByStatus = (
  userId: string,
  statuses: string[],
  onChange: (reservations: Reservation[]) => void
) => {
  console.log('Escutando reservas para userId:', userId, 'statuses:', statuses);
  
  const setStatuses = new Set(statuses);
  const reservationsFromReservas = new Map<string, Reservation>();
  const reservationsFromReservations = new Map<string, Reservation>();
  
  // Função para processar e combinar reservas de ambas as tabelas
  const processReservations = () => {
    // Combinar reservas de ambas as tabelas (reservations tem prioridade em caso de duplicata)
    const allReservations = new Map<string, Reservation>();
    
    // Primeiro adicionar de 'reservas'
    reservationsFromReservas.forEach((res, id) => {
      allReservations.set(id, res);
    });
    
    // Depois adicionar/sobrescrever com 'reservations' (prioridade)
    reservationsFromReservations.forEach((res, id) => {
      allReservations.set(id, res);
    });
    
    const out = Array.from(allReservations.values())
      .filter(r => setStatuses.has(r.status))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    console.log('Reservas filtradas encontradas:', out.length, 'IDs:', out.map(r => r.id));
    onChange(out);
  };
  
  // Escutar 'reservas' (português)
  const q1 = query(ref(db, 'reservas'), orderByChild('userId'));
  const handler1 = onValue(q1, (snap) => {
    console.log('Dados recebidos de "reservas", total:', snap.size);
    
    // Limpar e reconstruir o Map com os dados atuais
    reservationsFromReservas.clear();
    
    snap.forEach((child) => {
      const val = child.val();
      if (val.userId === userId) {
        const reservation: Reservation = {
          id: child.key as string,
          ...val
        };
        reservationsFromReservas.set(reservation.id, reservation);
        console.log('Reserva de "reservas" incluída:', child.key, 'status:', val.status);
      }
    });
    
    processReservations();
  });
  
  // Escutar 'reservations' (inglês)
  const q2 = query(ref(db, 'reservations'), orderByChild('userId'));
  const handler2 = onValue(q2, (snap) => {
    console.log('Dados recebidos de "reservations", total:', snap.size);
    
    // Limpar e reconstruir o Map com os dados atuais
    reservationsFromReservations.clear();
    
    snap.forEach((child) => {
      const val = child.val();
      if (val.userId === userId) {
        const reservation: Reservation = {
          id: child.key as string,
          ...val
        };
        reservationsFromReservations.set(reservation.id, reservation);
        console.log('Reserva de "reservations" incluída:', child.key, 'status:', val.status);
      }
    });
    
    processReservations();
  });

  return () => {
    off(q1, 'value', handler1);
    off(q2, 'value', handler2);
  };
};

// Cache para metadados de livros
const bookMetaCache = new Map<string, { titulo?: string; capa?: string; autor?: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função auxiliar para obter metadados com cache
const getCachedBookMeta = async (bookId: string) => {
  const cached = bookMetaCache.get(bookId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return { id: bookId, ...cached };
  }
  
  const meta = await getBookMeta(bookId);
  if (meta) {
    bookMetaCache.set(bookId, {
      titulo: meta.titulo,
      capa: meta.capa,
      autor: meta.autor,
      timestamp: now
    });
  }
  return meta;
};

export default function Emprestar() {
  const [loaded, error] = useFonts({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
  const [waitingList, setWaitingList] = useState<WaitItem[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoan[]>([]);
  const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [booksStatus, setBooksStatus] = useState<{[bookId: string]: BookStatus}>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  const listenersSetupRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u: User | null) => {
      setUserId(u?.uid || null);
    });
    return () => unsubscribeAuth();
  }, []);

  // Buscar status dos livros
  useEffect(() => {
    if (!userId) return;

    const bookIds = [...waitingList.map(item => item.bookId), ...pendingLoans.map(item => item.id), ...overdueLoans.map(item => item.bookId)];
    const uniqueBookIds = [...new Set(bookIds)];

    const unsubscribes: (() => void)[] = [];

    uniqueBookIds.forEach(bookId => {
      const statusRef = ref(db, `bookStatus/${bookId}`);
      const unsubscribe = onValue(statusRef, (snap) => {
        if (snap.exists()) {
          setBooksStatus(prev => ({
            ...prev,
            [bookId]: snap.val()
          }));
        }
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [userId, waitingList, pendingLoans, overdueLoans]);

  const calculateAvailability = useCallback((bookId: string, reservationStatus: string): string => {
    const status = booksStatus[bookId];
    
    if (!status) {
      return "Carregando...";
    }

    if (reservationStatus === 'aprovada' || reservationStatus === 'approved') {
      if (status.currentLoan && status.currentLoan.userId === userId) {
        const returnDate = new Date(status.currentLoan.expectedReturn);
        return `Devolução: ${returnDate.toLocaleDateString('pt-BR')}`;
      }
      return "Com você!";
    }

    if (status.currentLoan) {
      const returnDate = new Date(status.currentLoan.expectedReturn);
      return `Disponível em: ${returnDate.toLocaleDateString('pt-BR')}`;
    }

    if (status.available) {
      return "Disponível agora";
    }

    return "Em breve";
  }, [booksStatus, userId]);

  // Calcular posição na fila
  const calculateQueuePosition = useCallback(async (bookId: string, reservationId: string): Promise<number> => {
    try {
      const bookQueuesRef = ref(db, `bookQueues/${bookId}`);
      const snapshot = await get(bookQueuesRef);
      
      if (!snapshot.exists()) {
        return 0;
      }

      const queues = snapshot.val();
      const queueEntries = Object.entries(queues);
      
      console.log('Filas encontradas para livro', bookId, ':', queueEntries.length);
      
      const queueList = queueEntries
        .filter(([_, queue]: [string, any]) => {
          const queueStatus = queue.status;
          return queueStatus === 'pendente' || queueStatus === 'pending' || 
                 queueStatus === 'aguardando' || queueStatus === 'waiting';
        })
        .sort(([_, a]: [string, any], [__, b]: [string, any]) => {
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
      
      const position = queueList.findIndex(([id]) => id === reservationId) + 1;
      console.log('Posição na fila para reserva', reservationId, ':', position);
      
      return position > 0 ? position : 0;
      
    } catch (error) {
      console.error('Erro ao calcular posição na fila:', error);
      return 0;
    }
  }, []);

  // Verificar empréstimos atrasados - OTIMIZADO com processamento paralelo
  const checkOverdueLoans = useCallback(async (approvedReservations: Reservation[]) => {
    if (approvedReservations.length === 0) {
      setOverdueLoans([]);
      return;
    }

    try {
      // Processar todas as verificações em paralelo
      const overduePromises = approvedReservations.map(async (reservation) => {
        try {
          const [bookStatus, meta] = await Promise.all([
            getBookStatus(reservation.bookId),
            getCachedBookMeta(reservation.bookId)
          ]);
          
          if (bookStatus?.currentLoan && bookStatus.currentLoan.userId === userId) {
            const expectedReturn = bookStatus.currentLoan.expectedReturn;
            const returnDate = new Date(expectedReturn);
            const today = new Date();
            const diasAtraso = Math.ceil((today.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diasAtraso > 0) {
              return {
                id: reservation.id,
                reservaId: reservation.id,
                bookId: reservation.bookId,
                capa: meta?.capa || 'https://via.placeholder.com/100x150?text=Livro',
                titulo: meta?.titulo,
                dataDevolucaoEsperada: returnDate.toLocaleDateString('pt-BR'),
                diasAtraso,
                createdAt: reservation.createdAt
              };
            }
          }
          return null;
        } catch (error) {
          console.error('Erro ao verificar atraso:', error);
          return null;
        }
      });

      const results = await Promise.all(overduePromises);
      const overdue = results.filter((item) => item !== null) as OverdueLoan[];
      
      // Ordenar por data de criação (mais recente primeiro)
      const sortedOverdue = overdue.sort((a, b) => b.createdAt - a.createdAt);
      setOverdueLoans(sortedOverdue);
    } catch (error) {
      console.error('Erro ao verificar empréstimos atrasados:', error);
      setOverdueLoans([]);
    }
  }, [userId]);

  const handleWaitingListUpdate = useCallback(async (items: Reservation[]) => {
    console.log('🔄 handleWaitingListUpdate chamado com', items.length, 'itens');
    console.log('📋 IDs das reservas:', items.map(i => i.id));
    
    const filteredItems = items.filter(item => !cancellingIds.has(item.id));
    console.log('✅ Após filtrar cancelamentos:', filteredItems.length, 'itens');
    
    if (filteredItems.length === 0) {
      console.log('⚠️ Nenhum item após filtro, limpando lista');
      setWaitingList([]);
      setIsLoading(false);
      return;
    }

    // Só mostrar processing se não estiver no carregamento inicial
    if (!isInitialLoadRef.current) {
      setIsProcessing(true);
    }
    
    try {
      // Processar todas as operações em paralelo
      const mapped: WaitItem[] = await Promise.all(filteredItems.map(async (r) => {
        try {
          // Buscar metadados e status em paralelo
          const [meta, bookStatus] = await Promise.all([
            getCachedBookMeta(r.bookId),
            getBookStatus(r.bookId)
          ]);
          
          const statusText = bookStatus ? getBookStatusText(bookStatus) : 'Pendente';
          const disponibilidade = calculateAvailability(r.bookId, r.status);
          
          // Calcular posição na fila separadamente (pode ser mais lento)
          const queuePosition = await calculateQueuePosition(r.bookId, r.id);

          return { 
            reservaId: r.id, 
            bookId: r.bookId, 
            titulo: meta?.titulo, 
            capa: meta?.capa || 'https://via.placeholder.com/80x110?text=Livro', 
            id: r.id,
            disponivelApos: disponibilidade,
            status: statusText,
            reservationStatus: r.status,
            positionInQueue: queuePosition,
            createdAt: r.createdAt
          };
        } catch (error) {
          console.error('Erro ao processar reserva:', error);
          return {
            reservaId: r.id,
            bookId: r.bookId,
            titulo: 'Erro ao carregar',
            capa: 'https://via.placeholder.com/80x110?text=Erro',
            id: r.id,
            disponivelApos: 'Erro',
            status: 'Erro',
            reservationStatus: r.status,
            positionInQueue: 0,
            createdAt: r.createdAt
          };
        }
      }));
      
      // Ordenar por data de criação (mais recente primeiro)
      const sorted = mapped.sort((a, b) => b.createdAt - a.createdAt);
      console.log('Lista de espera atualizada:', sorted.length, 'itens');
      setWaitingList(sorted);
    } finally {
      // Adicionar um pequeno delay antes de desativar o loading para evitar flickering
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
      }, 300);
    }
  }, [cancellingIds, calculateAvailability, calculateQueuePosition]);

  // Carregar dados do usuário - OTIMIZADO
  useEffect(() => {
    const uid = userId;
    if (!uid) {
      console.log('Emprestimo: userId não disponível');
      setIsLoading(false);
      listenersSetupRef.current = false;
      isInitialLoadRef.current = true;
      return;
    }
    
    // Resetar flag se o userId mudou
    if (currentUserIdRef.current !== uid) {
      listenersSetupRef.current = false;
      isInitialLoadRef.current = true;
      currentUserIdRef.current = uid;
    }
    
    // Evitar recriar listeners se já foram configurados
    if (listenersSetupRef.current) {
      console.log('Listeners já configurados, pulando...');
      return;
    }
    
    console.log('Emprestimo: Iniciando listeners para userId:', uid);
    listenersSetupRef.current = true;
    
    // Só mostrar loading na primeira carga
    if (isInitialLoadRef.current) {
      setIsLoading(true);
      isInitialLoadRef.current = false;
    }
    
    let isProcessingApproved = false;
    let lastProcessedIds: string[] = [];
    
    const unSubApproved = listenUserReservationsByStatus(uid, ['aprovada', 'approved'], async (items: Reservation[]) => {
      // Evitar processamento múltiplo simultâneo
      if (isProcessingApproved) {
        console.log('Já processando reservas aprovadas, ignorando...');
        return;
      }
      
      // Verificar se os dados realmente mudaram (comparar IDs)
      const currentIds = items.map(i => i.id).sort();
      const currentIdsStr = currentIds.join(',');
      const lastIdsStr = lastProcessedIds.join(',');
      
      // Se é a primeira vez ou se os IDs mudaram, processar
      if (lastProcessedIds.length === 0 || currentIdsStr !== lastIdsStr) {
        console.log('Reservas aprovadas encontradas:', items.length, 'IDs:', currentIds);
        isProcessingApproved = true;
        lastProcessedIds = currentIds;
        setIsProcessing(true);
      } else {
        console.log('Dados não mudaram, ignorando atualização...');
        return;
      }
      
      try {
        // Processar empréstimos atrasados e pendentes em paralelo
        const [overdueResult, mapped] = await Promise.all([
          checkOverdueLoans(items),
          Promise.all(items.map(async (r) => {
            try {
              // Buscar metadados e status em paralelo
              const [meta, bookStatus] = await Promise.all([
                getCachedBookMeta(r.bookId),
                getBookStatus(r.bookId)
              ]);
              
              const statusText = bookStatus ? getBookStatusText(bookStatus) : 'Aprovado';
              const disponibilidade = calculateAvailability(r.bookId, r.status);
              
              return { 
                id: r.bookId, // Usar bookId como ID único
                titulo: meta?.titulo, 
                capa: meta?.capa || 'https://via.placeholder.com/100x150?text=Livro',
                status: statusText,
                dataDevolucao: disponibilidade,
                createdAt: r.createdAt
              };
            } catch (error) {
              console.error('Erro ao processar livro aprovado:', error);
              return {
                id: r.bookId,
                titulo: 'Erro ao carregar',
                capa: 'https://via.placeholder.com/100x150?text=Erro',
                status: 'Erro',
                dataDevolucao: 'Erro',
                createdAt: r.createdAt
              };
            }
          }))
        ]);
        
        // Ordenar por data de criação (mais recente primeiro)
        const sorted = mapped.sort((a, b) => b.createdAt - a.createdAt);
        console.log('Empréstimos pendentes atualizados:', sorted.length, 'itens');
        setPendingLoans(sorted);
      } finally {
        setIsLoading(false);
        isProcessingApproved = false;
        // Adicionar um pequeno delay antes de desativar o processing para evitar flickering
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
        }
        processingTimeoutRef.current = setTimeout(() => {
          setIsProcessing(false);
        }, 300);
      }
    });
    
    // Usar status em português para pendentes
    const unSubWaiting = listenUserReservationsByStatus(uid, ['pendente', 'pending', 'aguardando', 'waiting'], handleWaitingListUpdate);
    
    return () => { 
      console.log('Limpando listeners do Emprestimo');
      listenersSetupRef.current = false;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      unSubApproved(); 
      unSubWaiting(); 
    };
  }, [userId]);

  const handleCancelReservation = async (reservaId: string, livroTitulo: string) => {
    Alert.alert(
      "Cancelar Reserva",
      `Tem certeza que deseja cancelar a reserva do livro "${livroTitulo}"?`,
      [
        {
          text: "Manter",
          style: "cancel"
        },
        {
          text: "Cancelar Reserva",
          style: "destructive",
          onPress: async () => {
            // Adicionar ao set de cancelamento
            setCancellingIds(prev => new Set(prev).add(reservaId));
            
            // Remover da UI imediatamente para feedback visual
            setWaitingList(prev => prev.filter(item => item.reservaId !== reservaId));

            try {
              console.log('🔄 Iniciando cancelamento da reserva:', reservaId);
              await cancelReservation(reservaId);
              console.log('✅ Reserva cancelada com sucesso:', reservaId);
              
              // Remover do set de cancelamento após sucesso
              setCancellingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(reservaId);
                return newSet;
              });
              
              // Os listeners do Firebase vão atualizar automaticamente
              Alert.alert('Sucesso', 'Reserva cancelada com sucesso.');
            } catch (e: any) {
              console.error('❌ Erro ao cancelar reserva:', e);
              
              // Remover do set de cancelamento em caso de erro
              setCancellingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(reservaId);
                return newSet;
              });
              
              // Os listeners vão recarregar automaticamente, mas forçamos uma atualização
              // apenas para garantir que a UI seja restaurada
              Alert.alert('Erro', e?.message || 'Não foi possível cancelar a reserva. Tente novamente.');
            }
          }
        }
      ]
    );
  };

  const handleNotifyUser = (livroTitulo: string, diasAtraso: number) => {
    Alert.alert(
      "Notificar Usuário",
      `Enviar lembrete de devolução para o livro "${livroTitulo}"?\n\nLivro está atrasado há ${diasAtraso} dias.`,
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Enviar Notificação",
          onPress: () => {
            // Implementar o envio da notificação
            Alert.alert('📧 Notificação enviada', 'Lembrete de devolução enviado com sucesso.');
          }
        }
      ]
    );
  };

  if (!loaded && !error) {
    return null;
  }

  // Componente de Loading
  const LoadingOverlay = () => {
    if (!isLoading && !isProcessing) return null;
    
    return (
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>
            {isLoading ? 'Carregando empréstimos...' : 'Processando...'}
          </Text>
        </View>
      </View>
    );
  };

  const renderItemEmprestimo = ({ item }: { item: PendingLoan }) => (
    <View style={styles.livroItem}>
      <Image source={{ uri: item.capa }} style={styles.capaEmprestimo} />
    </View>
  );

  const renderItemReserva = ({ item }: { item: WaitItem }) => (
    <View style={styles.reservaItem}>
      <Image source={{ uri: item.capa }} style={styles.capaReserva} />
      <View style={styles.livroInfo}>
        <Text style={styles.livroTitulo} numberOfLines={2}>
          {item.titulo || 'Carregando...'}
        </Text>
        <Text style={styles.reservaStatus}>
          {item.reservationStatus === 'pending' || item.reservationStatus === 'pendente' 
            ? 'Aguardando aprovação' 
            : item.reservationStatus === 'waiting' || item.reservationStatus === 'aguardando'
            ? 'Na fila de espera'
            : 'Aprovada'}
          {item.positionInQueue > 0 && ` • Posição #${item.positionInQueue}`}
        </Text>
        <Text style={styles.livroData}>
          {item.disponivelApos}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => handleCancelReservation(item.reservaId, item.titulo || 'este livro')}
        disabled={cancellingIds.has(item.reservaId)}
      >
        <Text style={styles.cancelText}>
          {cancellingIds.has(item.reservaId) ? 'Cancelando...' : 'Cancelar'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemAtrasado = ({ item }: { item: OverdueLoan }) => (
    <View style={[styles.reservaItem, styles.overdueItem]}>
      <Image source={{ uri: item.capa }} style={styles.capaReserva} />
      <View style={styles.livroInfo}>
        <Text style={styles.livroTitulo} numberOfLines={2}>
          {item.titulo || 'Carregando...'}
        </Text>
        <View style={[styles.statusBadgeSmall, { backgroundColor: '#e74c3c' }]}>
          <Text style={styles.statusTextSmall}>Atrasado</Text>
        </View>
        <Text style={styles.overdueText}>
          Atrasado há {item.diasAtraso} {item.diasAtraso === 1 ? 'dia' : 'dias'}
        </Text>
        <Text style={styles.livroData}>
          Devolução esperada: {item.dataDevolucaoEsperada}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.notifyButton}
        onPress={() => handleNotifyUser(item.titulo || 'este livro', item.diasAtraso)}
      >
        <Text style={styles.notifyText}>Notificar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Header/>
      
      {/* Lembrete de Devolução - Só aparece se houver empréstimos atrasados */}
      {overdueLoans.length > 0 && (
        <View style={styles.lembreteAtraso}>
          <View style={styles.capaCover}>
            <Image 
              style={styles.capaImg}
              source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS1XDmIUDsyh8cfl9wSGes0c-GxAJcR72qllQ&s" }}
            />
          </View>
          <View style={styles.info}>
            <Text style={styles.infoTitle}>⚠️ Atenção: Livros Atrasados</Text>
            <Text style={styles.infoText}>
              Você tem {overdueLoans.length} livro{overdueLoans.length > 1 ? 's' : ''} em atraso. 
              Faça a devolução o quanto antes para evitar bloqueios.
            </Text>
          </View>
        </View>
      )}

      {/* Empréstimos Atrasados */}
      {overdueLoans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Empréstimos Atrasados ({overdueLoans.length})</Text>
          <FlatList
            data={overdueLoans}
            renderItem={renderItemAtrasado}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Empréstimos Pendentes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Empréstimos Pendentes</Text>
        {pendingLoans.length > 0 ? (
          <FlatList
            data={pendingLoans}
            renderItem={renderItemEmprestimo}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum empréstimo no momento</Text>
            <Text style={styles.emptySubText}>Seus livros aprovados aparecerão aqui</Text>
          </View>
        )}
      </View>

      {/* Reservas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minhas Reservas</Text>
        {waitingList.length > 0 ? (
          <FlatList
            data={waitingList}
            renderItem={renderItemReserva}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma reserva no momento</Text>
            <Text style={styles.emptySubText}>Suas reservas pendentes aparecerão aqui</Text>
          </View>
        )}
      </View>
      </ScrollView>
      <LoadingOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 15,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
  },
  lembreteAtraso: {
    flexDirection: 'row',
    backgroundColor: '#fff5f5',
    borderRadius: 15,
    padding: 15,
    margin: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  capaCover: {
    height: 80,
    width: 60,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
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
  infoTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginBottom: 5,
    color: '#e74c3c',
  },
  infoText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#666',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginBottom: 15,
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  livroItem: {
    width: 120,
    marginRight: 15,
    alignItems: 'center',
  },
  reservaItem: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  overdueItem: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 8,
    marginLeft: 8,
  },
  notifyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
  },
  cancelText: {
    color: '#e74c3c',
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
  },
  notifyText: {
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
  },
  // APENAS CAPA - Estilo simplificado para empréstimos
  capaEmprestimo: {
    width: 100,
    height: 150,
    borderRadius: 10,
  },
  capaReserva: {
    width: 60,
    height: 80,
    borderRadius: 6,
    marginRight: 12
  },
  livroInfo: {
    flex: 1,
  },
  livroTitulo: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 6,
    color: '#333',
  },
  livroData: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  overdueText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: '#e74c3c',
    marginBottom: 2,
  },
  reservaStatus: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    color: '#3498db',
    marginBottom: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusTextSmall: {
    color: 'white',
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
  },
  flatListContent: {
    paddingRight: 10,
  },
});