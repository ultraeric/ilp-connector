class QueueNode {
  constructor(val, next=null) {
    this.val = val;
    this.next = next;
  }
}

// Implements a standard queue for pushing/popping/peeking values
class Queue {
  constructor() {
    this.head = null;
    this.tail = null;

    this.push.bind(this);
    this.pop.bind(this);
    this.peek.bind(this);
  }

  push(val) {
    let newNode = new QueueNode(val);

    // If this is currently empty
    if (this.head === null) {
      this.head = newNode
    } else {
      this.tail.next = newNode;
      this.tail = newNode;
    }
    this.tail = newNode
  }

  pop() {
    let currHead = this.head;
    this.head = currHead.next;

    // If there are no more nodes, dereference tail as well
    if (this.head === null) {
      this.tail = null;
    }

    return currHead.val;
  }

  peek() {
    return this.head.val
  }
}

module.exports = Queue;
