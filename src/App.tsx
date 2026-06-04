/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ទំហំសម្រាប់ក្ដារ Infinite ដំបូង
const INITIAL_INFINITE_SIZE = 15;

export default function App() {
  // gameState មាន 'main_menu', 'setup_menu', 'playing'
  const [gameState, setGameState] = useState<string>('main_menu');
  const [gameMode, setGameMode] = useState<string>('pvp');
  
  // ការកំណត់កម្រិត AI
  const [aiDifficultyX, setAiDifficultyX] = useState<string>('medium'); 
  const [aiDifficultyO, setAiDifficultyO] = useState<string>('medium'); 

  // ការកំណត់ទម្រង់ក្ដារ
  const [boardMode, setBoardMode] = useState<string>('infinite'); // 'infinite' ឬ 'fixed'
  const [fixedSize, setFixedSize] = useState<number>(3); // ទំហំសម្រាប់ទម្រង់ Fixed (3, 4, 5, 10)

  // កំណត់ចំនួនឆូតដែលត្រូវការឈ្នះ (Win Condition) ផ្អែកលើទំហំក្ដារ
  const getWinCondition = useCallback((): number => {
    if (boardMode === 'infinite') return 5;
    if (fixedSize === 3) return 3;
    if (fixedSize === 4) return 4;
    return 5; // សម្រាប់ 5x5 និង 10x10
  }, [boardMode, fixedSize]);

  // អនុគមន៍បង្កើតក្ដារទទេ
  const createEmptyBoard = useCallback((): (string | null)[][] => {
    const size = boardMode === 'fixed' ? fixedSize : INITIAL_INFINITE_SIZE;
    return Array(size).fill(null).map(() => Array<string | null>(size).fill(null));
  }, [boardMode, fixedSize]);

  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard);
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [winningLine, setWinningLine] = useState<{ r: number; c: number }[]>([]);
  
  const [lastMove, setLastMove] = useState<{ r: number; c: number } | null>(null);

  const [scoreX, setScoreX] = useState<number>(0);
  const [scoreO, setScoreO] = useState<number>(0);
  const [snapshotData, setSnapshotData] = useState<{ grid: (string | null)[][]; line: { r: number; c: number }[] } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (gameState === 'main_menu' || gameState === 'setup_menu') {
        setBoard(createEmptyBoard());
    }
  }, [createEmptyBoard, gameState]);

  // --- មុខងារពិនិត្យអ្នកឈ្នះ ---
  const checkWin = useCallback((
    currentBoard: (string | null)[][],
    row: number,
    col: number,
    player: string,
    winCond: number
  ): { isWin: boolean; line: { r: number; c: number }[] } => {
    const rows = currentBoard.length;
    const cols = currentBoard[0].length;
    const directions: [number, number][][] = [
      [[0, 1], [0, -1]],
      [[1, 0], [-1, 0]],
      [[1, 1], [-1, -1]],
      [[1, -1], [-1, 1]]
    ];

    for (let i = 0; i < directions.length; i++) {
      const axis = directions[i];
      let count = 1;
      const line: { r: number; c: number }[] = [{ r: row, c: col }]; 

      for (let j = 0; j < axis.length; j++) {
        const [dx, dy] = axis[j];
        let r = row + dx;
        let c = col + dy;
        while (r >= 0 && r < rows && c >= 0 && c < cols && currentBoard[r][c] === player) {
          count++;
          line.push({ r, c });
          r += dx;
          c += dy;
        }
      }
      if (count >= winCond) return { isWin: true, line };
    }
    return { isWin: false, line: [] };
  }, []);

  // --- មុខងារពិនិត្យលទ្ធផលស្មើ (ពេញក្ដារ) ---
  const checkDraw = useCallback((currentBoard: (string | null)[][]): boolean => {
    for (let r = 0; r < currentBoard.length; r++) {
      for (let c = 0; c < currentBoard[0].length; c++) {
        if (!currentBoard[r][c]) return false; 
      }
    }
    return true; 
  }, []);

  // --- មុខងារ AI (Bot) ---
  const makeAIMove = useCallback((
    currentBoard: (string | null)[][],
    difficulty: string,
    player: string,
    winCond: number
  ): { r: number; c: number } | null => {
    const rows = currentBoard.length;
    const cols = currentBoard[0].length;
    const opponent = player === 'X' ? 'O' : 'X';
    
    let isEmpty = true;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (currentBoard[r][c] !== null) { isEmpty = false; break; }
        }
        if(!isEmpty) break;
    }
    if (isEmpty) return { r: Math.floor(rows / 2), c: Math.floor(cols / 2) };

    const evaluateCell = (r: number, c: number, targetPlayer: string, isAttack: boolean): number => {
        const directions: [number, number][][] = [
          [[0, 1], [0, -1]],
          [[1, 0], [-1, 0]],
          [[1, 1], [-1, -1]],
          [[1, -1], [-1, 1]]
        ];
        let score = 0;
        
        const getWeights = (diff: string) => {
            let w = { win: 0, blockWin1: 0, makeWin1: 0, blockWin2: 0, makeWin2: 0, make2: 0 };
            if (diff === 'easy') w = { win: 1000, blockWin1: 500, makeWin1: 100, blockWin2: 50, makeWin2: 10, make2: 1 };
            else if (diff === 'medium') w = { win: 100000, blockWin1: 10000, makeWin1: 5000, blockWin2: 1000, makeWin2: 500, make2: 10 };
            else w = { win: 1000000, blockWin1: 100000, makeWin1: 50000, blockWin2: 10000, makeWin2: 5000, make2: 100 };
            return w;
        };
        const weights = getWeights(difficulty);

        for (const axis of directions) {
            let count = 1;
            let blocks = 0;
            for (const [dx, dy] of axis) {
                let nr = r + dx;
                let nc = c + dy;
                let len = 0;
                while (nr >= 0 && nr < rows && nc >= 0 && nc < cols && len < winCond - 1) {
                    if (currentBoard[nr][nc] === targetPlayer) {
                        count++;
                    } else if (currentBoard[nr][nc] !== null) {
                        blocks++;
                        break;
                    } else {
                        break;
                    }
                    nr += dx;
                    nc += dy;
                    len++;
                }
            }
            
            if (count >= winCond) score += weights.win;
            else if (count === winCond - 1 && blocks === 0) score += (isAttack ? weights.makeWin1 : weights.blockWin1);
            else if (count === winCond - 1 && blocks === 1) score += (isAttack ? weights.makeWin1 * 0.1 : weights.blockWin1 * 0.5);
            else if (count === winCond - 2 && blocks === 0 && winCond > 3) score += (isAttack ? weights.makeWin2 : weights.blockWin2);
            else if (count === winCond - 2 && blocks === 1 && winCond > 3) score += (isAttack ? weights.makeWin2 * 0.1 : weights.blockWin2 * 0.2);
            else if (count === 2 && blocks === 0 && winCond > 4) score += weights.make2;
        }
        return score;
    };

    const possibleMoves: { r: number; c: number; score: number }[] = [];
    const searchDistance = difficulty === 'easy' ? 1 : (difficulty === 'hard' ? (winCond > 3 ? 3 : 2) : 2);
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (currentBoard[r][c] !== null) continue;
            
            let hasNeighbor = false;
            if (rows <= 3) {
                hasNeighbor = true;
            } else {
                for (let i = -searchDistance; i <= searchDistance; i++) {
                    for (let j = -searchDistance; j <= searchDistance; j++) {
                        if (r+i >= 0 && r+i < rows && c+j >= 0 && c+j < cols && currentBoard[r+i][c+j] !== null) {
                            hasNeighbor = true;
                            break;
                        }
                    }
                    if (hasNeighbor) break;
                }
            }
            
            if (hasNeighbor) {
                const attackScore = evaluateCell(r, c, player, true);
                const defenseScore = evaluateCell(r, c, opponent, false);
                
                const attackMultiplier = difficulty === 'hard' ? 1.1 : 1.0;
                const defenseMultiplier = difficulty === 'easy' ? 0.5 : 1.0;
                
                let totalScore = (attackScore * attackMultiplier) + (defenseScore * defenseMultiplier);
                if (rows === 3 && r === 1 && c === 1 && difficulty !== 'easy') totalScore += 50; 
                if (difficulty === 'easy') totalScore += Math.random() * 50; 

                possibleMoves.push({ r, c, score: totalScore });
            }
        }
    }

    if (possibleMoves.length === 0) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (currentBoard[r][c] === null) return { r, c };
            }
        }
        return null; 
    }

    possibleMoves.sort((a, b) => b.score - a.score);
    const maxScore = possibleMoves[0].score;
    
    let selectedMove: { r: number; c: number; score: number } | undefined;
    if (difficulty === 'easy' && possibleMoves.length > 3 && Math.random() > 0.7) {
        const fallbackIndex = Math.floor(Math.random() * 2) + 1;
        selectedMove = possibleMoves[fallbackIndex] || possibleMoves[0];
    } else {
        const topMoves = possibleMoves.filter(m => m.score === maxScore);
        selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
    }

    if (!selectedMove) return { r: possibleMoves[0].r, c: possibleMoves[0].c };
    return { r: selectedMove.r, c: selectedMove.c };
  }, []);

  // --- មុខងារថតរូប (Snapshot) ---
  const generateSnapshot = useCallback((
    currentBoard: (string | null)[][],
    line: { r: number; c: number }[],
    winCond: number
  ): void => {
    let sumR = 0, sumC = 0;
    line.forEach(cell => { sumR += cell.r; sumC += cell.c; });
    const centerR = Math.floor(sumR / line.length);
    const centerC = Math.floor(sumC / line.length);
    
    // បើក្ដារតូច មិនចាំបាច់ថតតែមួយផ្នែកទេ យកទាំងមូលមកតែម្តង
    if (currentBoard.length <= 5) {
        setSnapshotData({ grid: currentBoard, line: line });
        return;
    }

    const snapshotSize = Math.max(winCond * 2 + 1, 11); // កំណត់ទំហំរូបថតទៅតាមចំនួនឆូត
    const half = Math.floor(snapshotSize / 2);

    let startR = centerR - half;
    let startC = centerC - half;
    const rows = currentBoard.length;
    const cols = currentBoard[0].length;

    if (startR < 0) startR = 0;
    if (startC < 0) startC = 0;
    if (startR + snapshotSize > rows) startR = Math.max(0, rows - snapshotSize);
    if (startC + snapshotSize > cols) startC = Math.max(0, cols - snapshotSize);

    const snapshot: (string | null)[][] = [];
    const localLine: { r: number; c: number }[] = []; 
    for (let i = 0; i < Math.min(snapshotSize, rows - startR); i++) {
      const row: (string | null)[] = [];
      for (let j = 0; j < Math.min(snapshotSize, cols - startC); j++) {
        const globalR = startR + i;
        const globalC = startC + j;
        row.push(currentBoard[globalR][globalC]);
        if (line.some(l => l.r === globalR && l.c === globalC)) {
          localLine.push({ r: i, c: j });
        }
      }
      snapshot.push(row);
    }
    setSnapshotData({ grid: snapshot, line: localLine });
  }, []);

  // --- ដំណើរការដាក់ក្រឡា ---
  const processMove = useCallback((
    row: number,
    col: number,
    player: string,
    currentBoard: (string | null)[][],
    isXNext: boolean
  ): void => {
    let currentRows = currentBoard.length;
    let currentCols = currentBoard[0].length;
    const newBoard = currentBoard.map(arr => [...arr]);
    newBoard[row][col] = player;

    let expanded = false;
    let newRow = row;
    let newCol = col; 
    const winCond = getWinCondition();
    
    if (boardMode === 'infinite') {
        const margin = 4;
        if (newRow < margin) {
          const rowsToAdd = margin - newRow;
          for(let i=0; i < rowsToAdd; i++) newBoard.unshift(Array(currentCols).fill(null));
          newRow += rowsToAdd;
          currentRows += rowsToAdd;
          expanded = true;
        }
        if (currentRows - 1 - newRow < margin) {
          const rowsToAdd = margin - (currentRows - 1 - newRow);
          for(let i=0; i < rowsToAdd; i++) newBoard.push(Array(currentCols).fill(null));
          currentRows += rowsToAdd;
          expanded = true;
        }
        if (newCol < margin) {
          const colsToAdd = margin - newCol;
          for (let r = 0; r < currentRows; r++) {
            for(let i=0; i < colsToAdd; i++) newBoard[r].unshift(null);
          }
          newCol += colsToAdd;
          currentCols += colsToAdd;
          expanded = true;
        }
        if (currentCols - 1 - newCol < margin) {
          const colsToAdd = margin - (currentCols - 1 - newCol);
          for (let r = 0; r < currentRows; r++) {
            for(let i=0; i < colsToAdd; i++) newBoard[r].push(null);
          }
          expanded = true;
        }
    }

    setBoard(newBoard);
    setLastMove({ r: newRow, c: newCol });
    
    const winResult = checkWin(newBoard, newRow, newCol, player, winCond);
    
    if (winResult.isWin) {
      setWinner(player);
      setWinningLine(winResult.line);
      generateSnapshot(newBoard, winResult.line, winCond); 
      if (player === 'X') setScoreX(prev => prev + 1);
      else setScoreO(prev => prev + 1);
    } else {
      if (boardMode === 'fixed' && checkDraw(newBoard)) setIsDraw(true);
      else setXIsNext(!isXNext);
    }
    
    if (expanded && boardContainerRef.current) {
        setTimeout(() => {
            if(boardContainerRef.current) {
                const container = boardContainerRef.current;
                container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
                container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
            }
        }, 50);
    }
  }, [checkWin, checkDraw, generateSnapshot, boardMode, getWinCondition]);

  const handleClick = (row: number, col: number): void => {
    if (winner || isDraw || board[row][col]) return;
    if (gameMode === 'pve' && !xIsNext) return;
    if (gameMode === 'eve') return; 
    processMove(row, col, xIsNext ? 'X' : 'O', board, xIsNext);
  };

  useEffect(() => {
      if (gameState === 'playing' && !winner && !isDraw) {
          let isAITurn = false;
          let currentDifficulty = 'medium';
          const currentPlayer = xIsNext ? 'X' : 'O';

          if (gameMode === 'pve' && !xIsNext) {
              isAITurn = true;
              currentDifficulty = aiDifficultyO;
          } else if (gameMode === 'eve') {
              isAITurn = true;
              currentDifficulty = xIsNext ? aiDifficultyX : aiDifficultyO;
          }

          if (isAITurn) {
              const baseThinkTime = currentDifficulty === 'hard' ? 800 : (currentDifficulty === 'easy' ? 400 : 600);
              const thinkTime = gameMode === 'eve' ? baseThinkTime * 0.5 : baseThinkTime; 
              
              const timer = setTimeout(() => {
                  const winCond = getWinCondition();
                  const aiMove = makeAIMove(board, currentDifficulty, currentPlayer, winCond);
                  if(aiMove && typeof aiMove.r !== 'undefined') {
                      processMove(aiMove.r, aiMove.c, currentPlayer, board, xIsNext);
                  }
              }, thinkTime);
              return () => clearTimeout(timer);
          }
      }
  }, [xIsNext, gameState, gameMode, winner, isDraw, board, makeAIMove, processMove, aiDifficultyX, aiDifficultyO, getWinCondition]);

  useEffect(() => {
      if (gameState === 'playing') {
          if (lastMove) {
              const timer = setTimeout(() => {
                  const cellEl = document.getElementById(`cell-${lastMove.r}-${lastMove.c}`);
                  if (cellEl) cellEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              }, 50);
              return () => clearTimeout(timer);
          } else if (boardContainerRef.current) {
              const container = boardContainerRef.current;
              container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
              container.scrollTop = (container.scrollHeight - container.clientHeight) / 2;
          }
      }
  }, [lastMove, gameState]);

  const resetGame = (): void => {
    setBoard(createEmptyBoard());
    setXIsNext(gameMode === 'pve' ? true : (winner === 'O')); 
    setWinner(null);
    setIsDraw(false);
    setWinningLine([]); 
    setSnapshotData(null);
    setLastMove(null); 
  };

  const quitToMenu = (): void => {
      setGameState('main_menu');
      setScoreX(0);
      setScoreO(0); 
      setWinner(null);
      setIsDraw(false);
      setWinningLine([]);
      setSnapshotData(null);
      setLastMove(null);
      setXIsNext(true);
  };

  // ការផ្លាស់ប្តូរ Menu
  const selectMode = (mode: string): void => {
      setGameMode(mode);
      setGameState('setup_menu');
  };

  const isWinningCell = (r: number, c: number): boolean => winningLine.some(cell => cell.r === r && cell.c === c);
  const isLastMoveCell = (r: number, c: number): boolean => lastMove !== null && lastMove.r === r && lastMove.c === c;
  const colsCount = board[0]?.length || INITIAL_INFINITE_SIZE;

  // ================= UI រចនាបថទំនើប =================

  // ផ្ទាំងទី ១: ជ្រើសរើសរបៀបលេង (Main Menu)
  if (gameState === 'main_menu') {
      return (
          <div className="min-h-screen bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0f172a] to-black flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-[100px]"></div>

              <div className="bg-white/10 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-white/10 max-w-lg w-full text-center relative z-10 animate-modal-pop">
                  <div className="mb-2 inline-block bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 font-bold tracking-widest text-sm uppercase">Gomoku</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black mb-10 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 drop-shadow-lg tracking-tight">
                    Game X & O
                  </h1>

                  <div className="flex flex-col gap-4">
                      {/* Play with Friends */}
                      <button 
                          onClick={() => selectMode('pvp')}
                          className="group relative w-full p-1 rounded-2xl bg-gradient-to-r from-cyan-500/40 to-blue-500/40 hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25"
                      >
                          <div className="bg-[#121b2f] group-hover:bg-[#1a2642] transition-colors rounded-[14px] py-4 px-6 flex items-center justify-center gap-3">
                             <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                             <span className="font-bold text-lg text-white">លេងជាមួយមិត្តភក្ដិ</span>
                          </div>
                      </button>

                      {/* Play with AI */}
                      <button 
                          onClick={() => selectMode('pve')}
                          className="group relative w-full p-1 rounded-2xl bg-gradient-to-r from-rose-500/40 to-purple-500/40 hover:from-rose-400 hover:to-purple-400 transition-all duration-300 shadow-lg hover:shadow-rose-500/25"
                      >
                          <div className="bg-[#121b2f] group-hover:bg-[#1a2642] transition-colors rounded-[14px] py-4 px-6 flex items-center justify-center gap-3">
                             <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                             <span className="font-bold text-lg text-white">លេងជាមួយ AI</span>
                          </div>
                      </button>

                      {/* AI vs AI */}
                      <button 
                          onClick={() => selectMode('eve')}
                          className="group relative w-full p-1 rounded-2xl bg-gradient-to-r from-emerald-500/40 to-teal-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 shadow-lg hover:shadow-emerald-500/25"
                      >
                          <div className="bg-[#121b2f] group-hover:bg-[#1a2642] transition-colors rounded-[14px] py-4 px-6 flex items-center justify-center gap-3">
                             <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
                             <span className="font-bold text-lg text-white">AI ប្រកួតជាមួយ AI</span>
                          </div>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // ផ្ទាំងទី ២: កំណត់ទម្រង់លេង (Setup Menu)
  if (gameState === 'setup_menu') {
      return (
          <div className="min-h-screen bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0f172a] to-black flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]"></div>
              
              <div className="bg-white/10 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-white/10 max-w-md w-full relative z-10 animate-modal-pop">
                  
                  {/* ប៊ូតុងត្រឡប់ក្រោយ */}
                  <button 
                      onClick={() => setGameState('main_menu')}
                      className="absolute top-6 left-6 text-slate-400 hover:text-white transition flex items-center gap-1 bg-none border-none outline-none cursor-pointer"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>

                  <h2 className="text-2xl font-black text-center mb-8 text-white mt-2">
                      {gameMode === 'pvp' && 'លេងជាមួយមិត្តភក្ដិ'}
                      {gameMode === 'pve' && 'លេងជាមួយ AI'}
                      {gameMode === 'eve' && 'AI ប្រកួតជាមួយ AI'}
                  </h2>

                  <div className="flex flex-col gap-6">
                      
                      {/* --- ផ្នែកទី ១: ការកំណត់ក្ដារ --- */}
                      <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                          <h3 className="text-slate-300 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"></path></svg>
                              ទម្រង់ក្ដារលេង
                          </h3>
                          <div className="flex bg-black/40 p-1 rounded-xl mb-3">
                              <button onClick={() => setBoardMode('infinite')} className={`flex-1 py-2 text-sm rounded-lg font-bold transition-all border-none cursor-pointer ${boardMode === 'infinite' ? 'bg-white/20 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}>ស្វ័យប្រវត្តិ (៥ឆូត)</button>
                              <button onClick={() => setBoardMode('fixed')} className={`flex-1 py-2 text-sm rounded-lg font-bold transition-all border-none cursor-pointer ${boardMode === 'fixed' ? 'bg-white/20 text-white shadow-sm' : 'text-slate-400 hover:text-white bg-transparent'}`}>កំណត់ទំហំ</button>
                          </div>
                          
                          {boardMode === 'fixed' && (
                              <div className="grid grid-cols-2 gap-2 animate-modal-pop">
                                  <button onClick={() => setFixedSize(3)} className={`flex flex-col items-center py-2 rounded-xl transition-all border cursor-pointer ${fixedSize === 3 ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                      <span className="font-bold">3 x 3</span>
                                      <span className="text-[10px] opacity-70">3 ឆូតឈ្នះ</span>
                                  </button>
                                  <button onClick={() => setFixedSize(4)} className={`flex flex-col items-center py-2 rounded-xl transition-all border cursor-pointer ${fixedSize === 4 ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                      <span className="font-bold">4 x 4</span>
                                      <span className="text-[10px] opacity-70">4 ឆូតឈ្នះ</span>
                                  </button>
                                  <button onClick={() => setFixedSize(5)} className={`flex flex-col items-center py-2 rounded-xl transition-all border cursor-pointer ${fixedSize === 5 ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                      <span className="font-bold">5 x 5</span>
                                      <span className="text-[10px] opacity-70">5 ឆូតឈ្នះ</span>
                                  </button>
                                  <button onClick={() => setFixedSize(10)} className={`flex flex-col items-center py-2 rounded-xl transition-all border cursor-pointer ${fixedSize === 10 ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                      <span className="font-bold">10 x 10</span>
                                      <span className="text-[10px] opacity-70">5 ឆូតឈ្នះ</span>
                                  </button>
                              </div>
                          )}
                      </div>

                      {/* --- ផ្នែកទី ២: ការកំណត់កម្រិត AI (បង្ហាញតែពេលមាន AI) --- */}
                      {(gameMode === 'pve' || gameMode === 'eve') && (
                          <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                              <h3 className="text-slate-300 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                                  <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                  កម្រិតភាពឆ្លាតវៃ
                              </h3>
                              
                              <div className="flex flex-col gap-3">
                                  {gameMode === 'eve' && (
                                      <div className="flex items-center gap-3">
                                          <span className="text-cyan-400 font-bold text-xs w-12 bg-cyan-500/10 py-1 text-center rounded">AI (X)</span>
                                          <div className="flex-1 flex gap-1 bg-black/40 p-1 rounded-lg">
                                              <button onClick={() => setAiDifficultyX('easy')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyX === 'easy' ? 'bg-green-500/30 text-green-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>ខ្សោយ</button>
                                              <button onClick={() => setAiDifficultyX('medium')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyX === 'medium' ? 'bg-yellow-500/30 text-yellow-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>មធ្យម</button>
                                              <button onClick={() => setAiDifficultyX('hard')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyX === 'hard' ? 'bg-rose-500/30 text-rose-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>ខ្លាំង</button>
                                          </div>
                                      </div>
                                  )}
                                  <div className="flex items-center gap-3">
                                      <span className="text-rose-400 font-bold text-xs w-12 bg-rose-500/10 py-1 text-center rounded">AI (O)</span>
                                      <div className="flex-1 flex gap-1 bg-black/40 p-1 rounded-lg">
                                          <button onClick={() => setAiDifficultyO('easy')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyO === 'easy' ? 'bg-green-500/30 text-green-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>ខ្សោយ</button>
                                          <button onClick={() => setAiDifficultyO('medium')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyO === 'medium' ? 'bg-yellow-500/30 text-yellow-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>មធ្យម</button>
                                          <button onClick={() => setAiDifficultyO('hard')} className={`flex-1 py-1 text-xs rounded transition-colors border-none cursor-pointer ${aiDifficultyO === 'hard' ? 'bg-rose-500/30 text-rose-300' : 'text-slate-400 hover:text-white bg-transparent'}`}>ខ្លាំង</button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* ប៊ូតុងចាប់ផ្ដើមលេង */}
                      <button 
                          onClick={() => setGameState('playing')}
                          className="mt-2 w-full py-4 bg-white text-slate-900 rounded-xl font-black text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transform transition-all active:scale-95 uppercase tracking-wide border-none cursor-pointer"
                      >
                          ចាប់ផ្ដើមលេង
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- Render Board Cells (ធ្វើឲ្យក្រឡាធំៗសម្រាប់ក្ដារតូចៗ) ---
  const renderCell = (rowIndex: number, colIndex: number, cell: string | null) => {
    const isWinCell = isWinningCell(rowIndex, colIndex);
    const isLast = isLastMoveCell(rowIndex, colIndex);
    
    // ប្ដូរទំហំក្រឡាទៅតាមប្រភេទក្ដារ (ក្ដារតូច ក្រឡាធំ)
    let cellSizeClass = "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-2xl sm:text-3xl md:text-4xl";
    if (boardMode === 'fixed') {
        if (fixedSize === 3) cellSizeClass = "w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 text-5xl sm:text-7xl";
        else if (fixedSize === 4) cellSizeClass = "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-4xl sm:text-5xl";
        else if (fixedSize === 5) cellSizeClass = "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-3xl sm:text-4xl";
    }

    return (
      <div
        key={`${rowIndex}-${colIndex}`}
        id={`cell-${rowIndex}-${colIndex}`} 
        onClick={() => handleClick(rowIndex, colIndex)}
        className={`
          flex items-center justify-center font-black rounded-lg cursor-pointer transition-colors duration-200 relative
          border box-border ${cellSizeClass}
          ${!cell && !winner && !isDraw ? (gameMode === 'pve' && !xIsNext ? 'cursor-not-allowed bg-white/5 border-transparent' : 'bg-white/5 hover:bg-white/20 border-transparent hover:border-white/30') : ''}
          ${!isWinCell && cell && !isLast ? 'bg-white/10 border-white/10 shadow-inner' : ''}
          ${isWinCell ? 'win-neon-pulse border-transparent' : ''}
          ${isLast && !isWinCell ? 'last-move-highlight shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10' : ''}
        `}
      >
        <span className={`
          transition-colors duration-300
          ${cell === 'X' ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : ''}
          ${cell === 'O' ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.8)]' : ''}
          ${isWinCell ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]' : ''}
        `}>
          {cell}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e1b4b] via-[#0f172a] to-black flex flex-col items-center py-6 font-sans text-white relative overflow-hidden">
      
      <div className={`absolute top-0 right-0 w-full h-96 opacity-20 blur-[120px] transition-colors duration-700 pointer-events-none ${xIsNext ? 'bg-cyan-500' : 'bg-rose-500'}`}></div>

      <div className="w-full max-w-[95vw] md:max-w-4xl px-2 flex flex-col md:flex-row items-center justify-between gap-4 mb-6 z-10">
        
        <button 
          onClick={quitToMenu}
          className="self-start md:self-auto flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-4 py-2 rounded-xl transition-all hover:text-white backdrop-blur-sm shadow-lg cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          <span className="font-medium">ចាកចេញ</span>
        </button>

        <div className="flex bg-white/10 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-xl w-full md:w-auto min-w-[300px] relative mt-2 md:mt-0">
          
          {gameMode === 'eve' && (
              <div className="absolute -top-3 left-6 bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow-md">
                  AI: {aiDifficultyX === 'easy' ? 'ខ្សោយ' : aiDifficultyX === 'medium' ? 'មធ្យម' : 'ខ្លាំង'}
              </div>
          )}
          {(gameMode === 'pve' || gameMode === 'eve') && (
              <div className="absolute -top-3 right-6 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow-md">
                  AI: {aiDifficultyO === 'easy' ? 'ខ្សោយ' : aiDifficultyO === 'medium' ? 'មធ្យម' : 'ខ្លាំង'}
              </div>
          )}
          
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap shadow-md">
              {boardMode === 'infinite' ? 'ស្វ័យប្រវត្តិ (៥ឆូត)' : `${fixedSize}x${fixedSize} (${getWinCondition()}ឆូត)`}
          </div>

          <div className={`flex-1 flex flex-col items-center py-2 px-4 rounded-xl transition-colors ${xIsNext && !winner && !isDraw ? 'bg-white/10 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)]' : ''}`}>
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-1">
                {gameMode === 'eve' ? 'AI (X)' : (gameMode === 'pve' ? 'អ្នក (X)' : 'អ្នកលេង X')}
            </span>
            <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-b from-cyan-300 to-cyan-600 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{scoreX}</span>
          </div>
          <div className="w-px bg-white/10 mx-2 self-stretch"></div>
          <div className={`flex-1 flex flex-col items-center py-2 px-4 rounded-xl transition-colors ${!xIsNext && !winner && !isDraw ? 'bg-white/10 shadow-[inset_0_0_20px_rgba(251,113,133,0.2)]' : ''}`}>
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-1">
                {gameMode === 'eve' || gameMode === 'pve' ? 'AI (O)' : 'អ្នកលេង O'}
            </span>
            <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-b from-rose-300 to-rose-600 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]">{scoreO}</span>
          </div>
        </div>

        <div className="hidden md:block w-[100px]"></div> 
      </div>

      {!winner && !isDraw && (
        <div className="z-10 mb-6 flex items-center justify-center h-[40px]">
          {gameMode === 'eve' || (gameMode === 'pve' && !xIsNext) ? (
              <div className={`px-6 py-2 rounded-full border backdrop-blur-md shadow-lg transition-all duration-300 flex items-center gap-3 bg-slate-800/50 border-slate-600`}>
                 <svg className={`w-5 h-5 animate-spin ${xIsNext ? 'text-cyan-400' : 'text-rose-400'}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span className="font-semibold tracking-wide text-sm text-slate-300">
                     AI <strong className={xIsNext ? 'text-cyan-400' : 'text-rose-400'}>({xIsNext ? 'X' : 'O'})</strong> កំពុងគិត...
                 </span>
              </div>
          ) : (
              <div className={`px-6 py-2 rounded-full border backdrop-blur-md shadow-lg transition-all duration-300 flex items-center gap-3
                ${xIsNext ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200' : 'bg-rose-500/20 border-rose-400/50 text-rose-200'}`
              }>
                  <span className="font-semibold tracking-wide text-sm">
                    ដល់វេន៖ <strong className={`text-xl ${xIsNext ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]'}`}>{xIsNext ? 'X' : 'O'}</strong>
                  </span>
              </div>
          )}
        </div>
      )}
      {(winner || isDraw) && <div className="h-[40px] mb-6"></div>}

      <div className="w-full max-w-[95vw] md:max-w-5xl px-2 z-10 flex-1 flex flex-col justify-center">
        <div 
          ref={boardContainerRef}
          className="bg-white/5 backdrop-blur-xl p-3 md:p-5 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 overflow-auto max-h-[65vh] custom-scrollbar relative"
        >
          {gameMode === 'eve' && <div className="absolute inset-0 z-20 cursor-not-allowed"></div>}

          <div 
            className="grid gap-[2px] md:gap-1 p-1 w-max mx-auto transition-all duration-300 relative z-10"
            style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))` }}
          >
            {board.map((row, rowIndex) => (
              row.map((cell, colIndex) => renderCell(rowIndex, colIndex, cell))
            ))}
          </div>
        </div>
      </div>

      {/* Modal បង្ហាញអ្នកឈ្នះ ឬស្មើ */}
      {(winner || isDraw) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 pointer-events-auto">
          <div className="bg-slate-900/90 border border-white/20 rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] p-8 max-w-md w-full text-center transform animate-modal-pop relative overflow-hidden">
            
            <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full blur-[60px] opacity-50 ${winner === 'X' ? 'bg-cyan-500' : (winner === 'O' ? 'bg-rose-500' : 'bg-slate-500')}`}></div>
            <div className={`absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-50 ${winner === 'X' ? 'bg-cyan-500' : (winner === 'O' ? 'bg-rose-500' : 'bg-slate-500')}`}></div>

            <div className="relative z-10">
                <h2 className="text-3xl font-black mb-6 text-white tracking-tight">
                    {isDraw 
                        ? 'លទ្ធផលស្មើគ្នា! 🤝'
                        : (gameMode === 'eve' 
                            ? `AI ឈ្នះហើយ! 🤖🏆` 
                            : (gameMode === 'pve' ? (winner === 'X' ? 'អបអរសាទរ! 🏆' : 'អ្នកចាញ់ហើយ! 💀') : 'អបអរសាទរ! 🏆'))
                    }
                </h2>
                
                {winner && (
                    <div className="flex flex-col items-center gap-1 mb-6">
                      <span className="text-slate-400 font-medium text-sm uppercase tracking-widest">អ្នកឈ្នះក្ដារនេះ</span>
                      <div className={`mt-2 text-6xl font-black ${winner === 'X' ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]' : 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.8)]'}`}>
                        {gameMode === 'eve' 
                            ? `AI (${winner})` 
                            : (gameMode === 'pve' ? (winner === 'X' ? 'អ្នក (X)' : 'AI (O)') : `${winner}`)}
                      </div>
                    </div>
                )}
                
                {isDraw && (
                    <div className="text-slate-300 text-lg mb-8 bg-white/5 p-4 rounded-xl border border-white/10">
                        ក្រឡាក្ដារត្រូវបានបំពេញអស់ហើយ គ្មានអ្នកឈ្នះទេ។
                    </div>
                )}

                {snapshotData && winner && (
                  <div className="mb-8 bg-black/40 p-3 rounded-2xl border border-white/10 inline-block shadow-inner max-w-full overflow-hidden">
                    <div className="text-xs text-slate-500 mb-2 font-medium tracking-wide">ទិដ្ឋភាពកន្លែងដែលឈ្នះ</div>
                    <div 
                      className="grid gap-[1px] w-max mx-auto p-1 bg-white/5 rounded-lg"
                      style={{ gridTemplateColumns: `repeat(${snapshotData.grid[0].length}, minmax(0, 1fr))` }}
                    >
                      {snapshotData.grid.map((row, rIdx) => (
                        row.map((cell, cIdx) => {
                          const isLocalWin = snapshotData.line.some(l => l.r === rIdx && l.c === cIdx);
                          return (
                            <div
                              key={`snap-${rIdx}-${cIdx}`}
                              className={`
                                w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center 
                                text-[10px] sm:text-xs font-black rounded-sm border box-border
                                ${!cell ? 'bg-white/5 border-transparent' : 'bg-white/10 border-white/10'}
                                ${isLocalWin ? 'bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-[0_0_5px_rgba(52,211,153,0.8)] border-transparent' : ''}
                                ${!isLocalWin && cell === 'X' ? 'text-cyan-400' : ''}
                                ${!isLocalWin && cell === 'O' ? 'text-rose-400' : ''}
                              `}
                            >
                              {cell}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                )}

                <button
                    onClick={resetGame}
                    className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transform transition-all active:scale-95 cursor-pointer"
                >
                    {gameMode === 'eve' ? 'បន្តទស្សនាក្ដារបន្ទាប់' : 'លេងម្ដងទៀត'}
                </button>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modal-pop {
          0% { transform: scale(0.85) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        .animate-modal-pop {
          animation: modal-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes win-neon {
          0%, 100% { background: linear-gradient(135deg, #10b981, #059669); }
          50% { background: linear-gradient(135deg, #34d399, #10b981); box-shadow: 0 0 20px rgba(52,211,153,0.8); z-index: 20; }
        }
        .win-neon-pulse {
          animation: win-neon 1.5s ease-in-out infinite;
          position: relative;
          z-index: 20;
        }

        @keyframes highlight-pulse {
          0%, 100% { background-color: rgba(255, 255, 255, 0.1); border-color: rgba(251, 191, 36, 0.4); }
          50% { background-color: rgba(251, 191, 36, 0.15); border-color: rgba(251, 191, 36, 1); }
        }
        .last-move-highlight {
          animation: highlight-pulse 2s ease-in-out infinite;
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; border: 2px solid rgba(0,0,0,0); background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); border: 2px solid rgba(0,0,0,0); background-clip: padding-box; }
      `}} />
    </div>
  );
}
