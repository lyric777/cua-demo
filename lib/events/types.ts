export type ComputerActionType =
  | 'screenshot'
  | 'left_click'
  | 'right_click'
  | 'double_click'
  | 'mouse_move'
  | 'type'
  | 'key'
  | 'wait'
  | 'scroll'
  | 'left_click_drag'
  | 'middle_click'
  | 'triple_click';

export type ToolEventType = 'computer' | 'bash';

export type EventStatus = 'pending' | 'complete' | 'error';

export type AgentStatus = 'idle' | 'thinking' | 'executing';

export interface BaseToolEvent {
  id: string;
  toolCallId: string;
  timestamp: number;
  status: EventStatus;
  duration?: number;
}

export type ComputerToolResult =
  | { type: 'image'; data: string }
  | { type: 'text'; text: string }
  | { type: 'error'; error: string };

export type BashToolResult =
  | { output: string }
  | { error: string };

export interface ComputerToolEvent extends BaseToolEvent {
  type: 'computer';
  action: ComputerActionType;
  coordinate?: [number, number];
  text?: string;
  scroll_direction?: string;
  scroll_amount?: number;
  start_coordinate?: [number, number];
  result?: ComputerToolResult;
}

export interface BashToolEvent extends BaseToolEvent {
  type: 'bash';
  command: string;
  result?: BashToolResult;
}

export type ToolEvent = ComputerToolEvent | BashToolEvent;

export type ActionTypeCounts = Record<ComputerActionType | 'bash', number>;
