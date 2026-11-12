import type { ChatConfig, ChatEvent, ChatUsage } from '@deck/shared';
import { create } from 'zustand';
import { applyDelta, applyEvent, fromReplay, type Block, type PartialText } from './blocks';
import { filesMayHaveChanged } from '../files/filesTick';
import { tasksFrom, upsertTask, type ChatTask } from './tasks';

export interface ChatState {
  blocks: Block[];
  /** The agent is answering. */
  busy: boolean;
  /** The chat socket is connected (the conversation on screen is current). */
  online: boolean;
  /** True once the server has sent the conversation (before that the pane would look empty by mistake). */
  loaded: boolean;
  config: ChatConfig | null;
  tasks: ChatTask[];
  usage: ChatUsage | null;
}

const EMPTY: ChatState = {
  blocks: [],
  busy: false,
  online: false,
  loaded: false,
  config: null,
  tasks: [],
  usage: null,
};

interface ChatsState {
  byId: Record<string, ChatState>;
  replay(
    id: string,
    data: { events: ChatEvent[]; partials: PartialText[]; busy: boolean; config: ChatConfig },
  ): void;
  /** A rewind happened: the chat shown is replaced by these events. */
  reset(id: string, events: ChatEvent[]): void;
  event(id: string, event: ChatEvent): void;
  delta(id: string, delta: PartialText): void;
  setBusy(id: string, busy: boolean): void;
  setConfig(id: string, config: ChatConfig): void;
  setUsage(id: string, usage: ChatUsage): void;
  setOnline(id: string, online: boolean): void;
  forget(id: string): void;
}

export const useChats = create<ChatsState>()((set) => {
  const patch = (id: string, change: (chat: ChatState) => Partial<ChatState>): void =>
    set((s) => {
      const chat = s.byId[id] ?? EMPTY;
      return { byId: { ...s.byId, [id]: { ...chat, ...change(chat) } } };
    });
  return {
    byId: {},
    replay: (id, data) =>
      patch(id, () => ({
        blocks: fromReplay(data.events, data.partials),
        tasks: tasksFrom(data.events),
        busy: data.busy,
        config: data.config,
        loaded: true,
      })),
    reset: (id, events) =>
      patch(id, () => ({ blocks: fromReplay(events, []), tasks: tasksFrom(events) })),
    event: (id, event) => {
      if (event.t === 'tool-result' || event.t === 'turn-end') filesMayHaveChanged(id);
      patch(id, (chat) => ({
        blocks: applyEvent(chat.blocks, event),
        ...(event.t === 'task' ? { tasks: upsertTask(chat.tasks, event) } : {}),
        // A turn that starts or ends moves the busy light even if the `busy` message is late.
        ...(event.t === 'turn-start'
          ? { busy: true }
          : event.t === 'turn-end'
            ? { busy: false }
            : {}),
      }));
    },
    delta: (id, delta) => patch(id, (chat) => ({ blocks: applyDelta(chat.blocks, delta) })),
    setBusy: (id, busy) => patch(id, () => ({ busy })),
    setConfig: (id, config) => patch(id, () => ({ config })),
    setUsage: (id, usage) => patch(id, () => ({ usage })),
    setOnline: (id, online) => patch(id, () => ({ online })),
    forget: (id) =>
      set((s) => ({
        byId: Object.fromEntries(Object.entries(s.byId).filter(([key]) => key !== id)),
      })),
  };
});

export const useChat = (id: string): ChatState => useChats((s) => s.byId[id] ?? EMPTY);
