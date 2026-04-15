import type { Node, NodeId, OptionsOptionNode, Scene, Story } from './types';

export function createRunner(story: Story) {
  let scene: Scene | null = null;
  let node: Node | null = null;

  function setScene(name: string) {
    scene = story.find((scene) => scene.name === name) ?? null;
    node = scene?.startNodeId ? scene.nodes.get(scene.startNodeId) ?? null : null
    return node;
  }

  function setNextNode(nodeId: NodeId | null) {
    if (nodeId === null) {
      node = null;
    } else {
      node = scene?.nodes.get(nodeId) ?? null;
    }
  }

  function chooseOption(option: OptionsOptionNode | null) {
    if (node?.kind !== 'options') {
      throw new Error(
        'Cannot choose an option, currently not at an option node.',
      );
    }
    if (option === null) {
      node = null;
    } else {
      setNextNode(option.next);
    }

    return node;
  }

  function next(): Node | null {
    if (!node) return null;
    switch (node.kind) {
      case 'text': {
        setNextNode(node.next);
        break;
      }
      case 'command': {
        setNextNode(node.next);
        break;
      }
      case 'options': {
        break;
      }
    }

    return node;
  }

  return { setScene, next, chooseOption };
}
