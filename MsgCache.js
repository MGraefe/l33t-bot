
const fs = require('fs');

class MsgCache {
  constructor(chatId, storageDir = 'buffer') {
    this.chatId = chatId;
    this.storageDir = storageDir;
  
    this.filePath = `${storageDir}/${chatId}.json`;

    this.buffer = {
      version: 1,
      messages: [],
    };
  }


  readFromDisk() {
    if (!fs.existsSync(this.filePath))
      return false;
    
    const jsonText = fs.readFileSync(this.filePath, 'utf-8');
    if (!jsonText) {
      throw new Error("Cannot read buffer file");
    }

    this.buffer = JSON.parse(jsonText);
    if (this.buffer.version != 1) {
      throw new Error("Unknown buffer file version");
    }

    console.log(`parsed ${this.buffer.messages.length} old messages from cache`);
    
    return true;
  }


  /**
   * @typedef {Object} CacheMessage
   * @property {string} id unique message id
   * @property {string} author message author tag
   * @property {number} timestamp unix timestamp of message
   * @property {string} body message text
   */

  /**
   * @param {import('whatsapp-web.js').Message[]} msgs Messages sorted from old to new
   * @returns {CacheMessage[] | null} New list of messages in the cache, or null if the newest
   * message id in the cache isn't part of msgs, in which case more messages need to be requested.
   */
  appendMessages(msgs) {
    const msgsToAdd = []; // new messages, sorted from new to old
    const newestBufferedId = this.buffer.messages[this.buffer.messages.length - 1]?.id;
    for (const msg of [...msgs].reverse()) {
      const {id, author, timestamp, body} = msg;
      if (id.id === newestBufferedId) {
        console.log('found newest id in buffer');
        break;
      }
      msgsToAdd.push({id: id.id, author, timestamp, body});
    }

    if (newestBufferedId && msgsToAdd.length === msgs.length) {
      console.log('MessageCache needs more messages!');
      return null;
    }

    console.log(`adding ${msgsToAdd.length} messages to buffer`);

    // append messages to buffer, but in old -> new order
    this.buffer.messages.push(...msgsToAdd.reverse());
    return this.buffer.messages;
  }


  writeToDisk() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir);
    }
    const jsonText = JSON.stringify(this.buffer, null, 2);
    fs.writeFileSync(this.filePath, jsonText, 'utf-8');
    console.log(`stored cache in ${this.filePath}`);
  }


  clear() {
    this.buffer.messages = [];
  }
}

module.exports = MsgCache;
