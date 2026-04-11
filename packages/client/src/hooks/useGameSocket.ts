import { useEffect } from 'react';
import { connectSocket, getSocket } from '../socket/client';
import { useGameStore } from '../store/gameStore';

export function useGameSocket() {
  const {
    setConnected,
    setConnecting,
    setError,
    setGameState,
    appendLog,
    setDiceResult,
    setGameOver,
    setDeckContents,
    setReconnectToken,
  } = useGameStore();

  useEffect(() => {
    const socket = connectSocket();

    const onConnect = () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = (err: Error) => {
      setConnecting(false);
      setError(`Connection error: ${err.message}`);
    };

    const onGameState = (state: Parameters<typeof setGameState>[0]) => {
      setGameState(state);
    };

    const onGameLog = (entries: Parameters<typeof appendLog>[0]) => {
      appendLog(entries);
    };

    const onDiceResult = (result: Parameters<typeof setDiceResult>[0]) => {
      setDiceResult(result);
    };

    const onGameEnded = (info: { winnerId: string; winnerName: string }) => {
      setGameOver(info);
    };

    const onGameError = (payload: { message: string }) => {
      setError(payload.message);
      // Auto-clear after 5s
      setTimeout(() => setError(null), 5000);
    };

    const onDeckContents = (payload: { deckType: string; cardIds: string[] }) => {
      setDeckContents(payload.deckType, payload.cardIds);
    };

    const onRoomToken = (payload: { token: string }) => {
      setReconnectToken(payload.token);
      sessionStorage.setItem('fs_reconnect_token', payload.token);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('game:state', onGameState);
    socket.on('game:log', onGameLog);
    socket.on('dice:result', onDiceResult);
    socket.on('game:ended', onGameEnded);
    socket.on('game:error', onGameError);
    socket.on('deck:contents', onDeckContents);
    socket.on('room:token', onRoomToken);

    if (socket.connected) {
      setConnected(true);
    } else {
      setConnecting(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('game:state', onGameState);
      socket.off('game:log', onGameLog);
      socket.off('dice:result', onDiceResult);
      socket.off('game:ended', onGameEnded);
      socket.off('game:error', onGameError);
      socket.off('deck:contents', onDeckContents);
      socket.off('room:token', onRoomToken);
    };
  }, []);
}
