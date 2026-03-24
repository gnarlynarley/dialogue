import { createRunner, parse } from '../src';
import type { Node, NodeId, OptionsOptionNode, Scene } from '../src';

const story = parse(`
---
name: Start
---

Hello world
This is the second line

> Option 1
  > Option 1.1
    This is followup text for option 1.1
    This is followup text for option 1.1
  > Option 1.2
    This is followup text for option 1.2
> Option 2

[commandname:argument]
[commandnamewithoutargument]

After all options are exhausted it will always end up here
[scene:End]
===

---
name: End
---
The end
===
`);

const runner = createRunner(story);

let node = runner.jump('Start');
while (node) {
  switch (node.kind) {
    case 'text': {
      console.log(node.text);
      node = runner.next();
      break;
    }
    case 'command': {
      console.log(node.name);
      node = runner.next();
      break;
    }
    case 'options': {
      const option =
        node.options[Math.floor(Math.random() * node.options.length)];
      if (!option) {
        node = null;
        break;
      }
      console.log(option.text);
      node = runner.chooseOption(option);
      break;
    }
  }
}
