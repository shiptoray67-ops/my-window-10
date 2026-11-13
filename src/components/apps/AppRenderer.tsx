import React from 'react';
import { WindowInstance } from '../../types/os';
import { useOS } from '../../context/OSContext';
import { EdgeBrowser } from './EdgeBrowser';
import { FileExplorer } from './FileExplorer';
import { NotepadApp } from './NotepadApp';
import { WordPadApp } from './WordPadApp';
import { CalculatorApp } from './CalculatorApp';
import { PaintApp } from './PaintApp';
import { CalendarApp } from './CalendarApp';
import { ClockApp } from './ClockApp';
import { PhotosApp } from './PhotosApp';
import { MediaPlayerApp } from './MediaPlayerApp';
import { CameraApp } from './CameraApp';
import { WeatherApp } from './WeatherApp';
import { StickyNotesApp } from './StickyNotesApp';
import { SnippingToolApp } from './SnippingToolApp';
import { TaskManagerApp } from './TaskManagerApp';
import { CmdApp } from './CmdApp';
import { MicrosoftStoreApp } from './MicrosoftStoreApp';
import { SettingsApp } from './SettingsApp';
import { SnakeGame } from '../games/SnakeGame';
import { Game2048 } from '../games/Game2048';
import { MinesweeperGame } from '../games/MinesweeperGame';
import { ChessGame } from '../games/ChessGame';
import { TetrisGame } from '../games/TetrisGame';
import { SudokuGame } from '../games/SudokuGame';
import { SolitaireGame } from '../games/SolitaireGame';

export const AppRenderer: React.FC<{ win: WindowInstance }> = ({ win }) => {
  const { getAppDefinition } = useOS();

  if (win.appId.startsWith('webapp-')) {
    const def = getAppDefinition(win.appId);
    return <EdgeBrowser win={win} standaloneUrl={def?.webUrl} />;
  }

  switch (win.appId) {
    case 'explorer':
      return <FileExplorer win={win} />;
    case 'edge':
      return <EdgeBrowser win={win} />;
    case 'notepad':
      return <NotepadApp win={win} />;
    case 'wordpad':
      return <WordPadApp win={win} />;
    case 'calculator':
      return <CalculatorApp />;
    case 'paint':
      return <PaintApp />;
    case 'calendar':
      return <CalendarApp />;
    case 'clock':
      return <ClockApp />;
    case 'photos':
      return <PhotosApp win={win} />;
    case 'mediaplayer':
      return <MediaPlayerApp win={win} />;
    case 'camera':
      return <CameraApp />;
    case 'weather':
      return <WeatherApp />;
    case 'stickynotes':
      return <StickyNotesApp />;
    case 'snipping':
      return <SnippingToolApp />;
    case 'taskmanager':
      return <TaskManagerApp />;
    case 'cmd':
      return <CmdApp win={win} />;
    case 'store':
      return <MicrosoftStoreApp />;
    case 'settings':
      return <SettingsApp win={win} />;
    case 'game-snake':
      return <SnakeGame />;
    case 'game-2048':
      return <Game2048 />;
    case 'game-minesweeper':
      return <MinesweeperGame />;
    case 'game-chess':
      return <ChessGame />;
    case 'game-tetris':
      return <TetrisGame />;
    case 'game-sudoku':
      return <SudokuGame />;
    case 'game-solitaire':
      return <SolitaireGame />;
    default:
      return null;
  }
};
