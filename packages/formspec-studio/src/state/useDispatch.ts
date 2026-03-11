import type { AnyCommand, CommandResult } from 'formspec-studio-core';
import { useContext } from 'react';
import { DispatchContext } from './ProjectContext';

export function useDispatch(): (command: AnyCommand) => CommandResult {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useDispatch must be used within a ProjectProvider');
  return dispatch;
}
