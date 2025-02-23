'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useStore from '@/store/useStore';
import { News } from '@/types';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export const useReadingList = () => {
  const { user, saveNews, unsaveNews, addToReadHistory, setUser } = useStore();
  const [savedNewsList, setSavedNewsList] = useState<News[]>([]);
  const [readHistory, setReadHistory] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega as notícias salvas
  useEffect(() => {
    const fetchSavedNews = async () => {
      console.log('[useReadingList] Iniciando fetchSavedNews:', {
        userId: user?.id,
        savedNewsCount: user?.savedNews?.length,
      });

      if (!user) {
        setSavedNewsList([]);
        setLoading(false);
        return;
      }

      try {
        // Primeiro busca todas as notícias salvas do usuário
        const savedNewsQuery = query(
          collection(db, 'savedNews'),
          where('userId', '==', user.id),
          where('status', '==', 'active')
        );

        const savedNewsSnapshot = await getDocs(savedNewsQuery);
        const savedNewsIds = savedNewsSnapshot.docs.map(
          (doc) => doc.data().newsId
        );

        console.log('[useReadingList] Notícias salvas encontradas:', {
          count: savedNewsIds.length,
          ids: savedNewsIds,
        });

        // Atualiza o estado do usuário com as notícias salvas do Firestore
        setUser({
          ...user,
          savedNews: savedNewsIds,
        });

        // Agora busca os detalhes das notícias
        if (savedNewsIds.length > 0) {
          const newsQuery = query(
            collection(db, 'news'),
            where('__name__', 'in', savedNewsIds)
          );

          const snapshot = await getDocs(newsQuery);
          const newsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as News[];

          console.log('[useReadingList] Detalhes das notícias carregados:', {
            count: newsData.length,
            ids: newsData.map((n) => n.id),
          });

          setSavedNewsList(newsData);
        } else {
          setSavedNewsList([]);
        }
      } catch (error) {
        console.error('[useReadingList] Erro ao carregar notícias:', error);
        toast.error('Erro ao carregar notícias salvas');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedNews();
  }, [user?.id, setUser]);

  // Carrega o histórico de leitura
  useEffect(() => {
    const fetchReadHistory = async () => {
      if (!user?.readHistory.length) {
        setReadHistory([]);
        return;
      }

      try {
        const newsIds = user.readHistory.map((item) => item.newsId);
        const newsQuery = query(
          collection(db, 'news'),
          where('id', 'in', newsIds)
        );

        const snapshot = await getDocs(newsQuery);
        const newsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as News[];

        // Ordena as notícias na mesma ordem do histórico
        const orderedNews = user.readHistory
          .map((historyItem) =>
            newsData.find((news) => news.id === historyItem.newsId)
          )
          .filter((news): news is News => news !== undefined);

        setReadHistory(orderedNews);
      } catch (error) {
        console.error('Erro ao carregar histórico de leitura:', error);
        toast.error('Erro ao carregar histórico de leitura');
      }
    };

    fetchReadHistory();
  }, [user?.readHistory]);

  const toggleSaveNews = async (newsId: string) => {
    console.log('[useReadingList] Iniciando toggleSaveNews:', {
      newsId,
      userId: user?.id,
      currentSavedNews: user?.savedNews,
      isInLibrary: window.location.pathname === '/perfil/biblioteca',
    });

    if (!user) {
      toast.error('Você precisa estar logado para salvar notícias');
      return;
    }

    // Se estamos na biblioteca, a notícia está salva por definição
    const isSaved =
      window.location.pathname === '/perfil/biblioteca' ||
      user.savedNews.includes(newsId);
    console.log('[useReadingList] Estado da notícia:', { isSaved, newsId });

    try {
      if (isSaved) {
        console.log('[useReadingList] Removendo notícia:', newsId);

        // Remove do Zustand primeiro
        unsaveNews(newsId);
        setSavedNewsList((prev) => prev.filter((news) => news.id !== newsId));

        // Remove do Firestore
        const savedNewsQuery = query(
          collection(db, 'savedNews'),
          where('userId', '==', user.id),
          where('newsId', '==', newsId)
        );

        const snapshot = await getDocs(savedNewsQuery);
        if (!snapshot.empty) {
          await Promise.all(snapshot.docs.map((doc) => deleteDoc(doc.ref)));
        }

        console.log('[useReadingList] Notícia removida com sucesso');
        toast.success('Notícia removida dos salvos');

        // Atualiza o estado do usuário
        setUser({
          ...user,
          savedNews: user.savedNews.filter((id) => id !== newsId),
        });

        // Se estamos na biblioteca, precisamos atualizar a lista
        if (window.location.pathname === '/perfil/biblioteca') {
          setSavedNewsList((prev) => prev.filter((news) => news.id !== newsId));
        }
      } else {
        console.log('[useReadingList] Salvando notícia:', newsId);

        // Salva no Zustand primeiro
        saveNews(newsId);

        // Salva no Firestore
        await addDoc(collection(db, 'savedNews'), {
          userId: user.id,
          newsId: newsId,
          status: 'active',
          createdAt: new Date(),
          type: 'savedNews',
        });

        // Busca os detalhes da notícia se ainda não estiver na lista
        if (!savedNewsList.find((news) => news.id === newsId)) {
          const newsDoc = await getDocs(
            query(collection(db, 'news'), where('__name__', '==', newsId))
          );
          if (!newsDoc.empty) {
            const newsData = {
              id: newsDoc.docs[0].id,
              ...newsDoc.docs[0].data(),
            } as News;
            setSavedNewsList((prev) => [...prev, newsData]);
          }
        }

        console.log('[useReadingList] Notícia salva com sucesso');
        toast.success('Notícia salva com sucesso!');
      }

      // Atualiza o estado do usuário para manter sincronizado
      setUser({
        ...user,
        savedNews: isSaved
          ? user.savedNews.filter((id) => id !== newsId)
          : [...user.savedNews, newsId],
      });
    } catch (error) {
      console.error('[useReadingList] Erro ao salvar/remover notícia:', error);
      toast.error('Erro ao salvar/remover notícia');
    }
  };

  const updateReadProgress = (newsId: string, progress: number) => {
    if (!user) return;

    addToReadHistory(newsId, progress);
  };

  return {
    loading,
    savedNews: savedNewsList,
    readHistory,
    toggleSaveNews,
    updateReadProgress,
    isSaved: (newsId: string) => user?.savedNews.includes(newsId) || false,
  };
};
