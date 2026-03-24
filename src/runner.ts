import type { Node, NodeId, OptionsOptionNode, Scene, Story } from './types';

export function createRunner(story: Story) {
  let currentScene: Scene | null = null;
  let currentNode: Node | null = null;

  function jump(name: string) {
    currentScene = story.find((scene) => scene.name === name) ?? null;
    currentNode = currentScene?.startNodeId
      ? (currentScene?.nodes.get(currentScene.startNodeId) ?? null)
      : null;

    return currentNode;
  }

  function setNextNode(nodeId: NodeId | null) {
    if (nodeId === null) {
      currentNode = null;
    } else {
      currentNode = currentScene?.nodes.get(nodeId) ?? null;
    }
  }

  function chooseOption(option: OptionsOptionNode | null) {
    if (option === null) {
      currentNode = null;
    } else {
      setNextNode(option.next);
    }

    return currentNode;
  }

  function next(): Node | null {
    if (!currentNode) return null;
    switch (currentNode.kind) {
      case 'text': {
        setNextNode(currentNode.next);
        break;
      }
      case 'command': {
        setNextNode(currentNode.next);
        break;
      }
      case 'options': {
        throw new Error('should choose option.');
      }
    }

    return currentNode;
  }

  return { jump, next, chooseOption };
}
