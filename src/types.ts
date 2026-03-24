export type NodeId = string;

export type TextNode = {
  kind: 'text';
  id: NodeId;
  text: string;
  next: NodeId | null;
};

export type CommandNode = {
  kind: 'command';
  id: NodeId;
  name: string;
  argument: string | null;
  next: NodeId | null;
};

export type OptionId = string;
export type OptionsOptionNode = {
  id: OptionId;
  text: string;
  next: NodeId | null;
};
export type OptionsNode = {
  kind: 'options';
  id: NodeId;
  options: OptionsOptionNode[];
};

export type Node = TextNode | CommandNode | OptionsNode;

export type Scene = {
  name: string;
  startNodeId: NodeId | null;
  nodes: Map<NodeId, Node>;
};

export type Story = Scene[];
