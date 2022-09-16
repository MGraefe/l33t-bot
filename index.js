
const MsgCache = require('./MsgCache.js');
const qrcode = require('qrcode');
const WAWebJS = require('whatsapp-web.js');
const fs = require('fs');

const GROUP_ID = process.env.L33TBOT_GROUP_ID;
const QR_FILENAME = process.env.L33TBOT_QR_FILENAME || 'qr.png';

const DAY_MS = 1000 * 60 * 60 * 24; // 1 day in milliseconds

const client = new WAWebJS.Client({
  authStrategy: new WAWebJS.LocalAuth(),
  // puppeteer: {headless: false},
  // userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
});

let shutdownTimer = null;


async function getAuthorName(authorId) {
  const contact = await client.getContactById(authorId);
  this.authorName = contact.shortName || contact.name || contact.pushname || 'Unbekannt';
  // My own name doesn't have a short name for some reason, still try to parse only first name
  return this.authorName.split(' ')[0];
}


class StreakCounter
{
  constructor(authorId = null) {
    this.authorId = authorId;
    this.streak = 0;
    this.count = 0;
    this.ended = false;
    this.l33ted = false;
  }

  countL33t() {
    if (!this.l33ted) {
      if (!this.ended) {
        this.streak += 1;
      }
      this.count += 1;
      this.l33ted = true;
    }
  }

  end() {
    this.ended = true;
  }

  wrapNextDay() {
    if (!this.l33ted) {
      this.ended = true;
    }
    this.l33ted = false;
  }

  isRelevant() {
    return this.count > 0;
  }

  async getMessage() {
    const authorName = await this.resolveAuthorName();
    return `*${authorName}*: Beitrag: ${this.count}, Pers. Strähne: ${this.streak}`;
  }

  async resolveAuthorName() {
    return getAuthorName(this.authorId);
  }
}


/**
 * Quit after a little grace period
 * @param {number} code exit code
 */
function shutdown(code) {
  client.destroy().then(() => {
    setTimeout(() => {
      process.exit(code);
    }, 1000); // wait a little before finally closing
  });
}


/**
 * get message for specific l33t counter
 * @param {number} counter 
 */
function getMessageQuip(counter) {
  const messageTexts = [
    [0, `, RIP STRÄHNE Sadge`],
    [1, `...alles fängt mal klein an`],
    [5, `'er Strähne...weiter so!`],
    [10, `'er Strähne...nice!`],
    [15, `'er Strähne...hype!`],
    [25, `'er Strähne! MEGAHYPE!`],
    [40, `'er Strähne...POGGERS!`],
    [50, `'er Strähne...MEGA POGGERS!`],
    [70, `'er Strähne...GIGA POGGERS!`],
    [80, `'er Strähne...MO MO MO MONSTER POGGERS`],
    [90, `'er Strähne...so weit schaffens wir eh nie...`],
    [100, `'er Strähne...ab jetzt wirds unrealistisch`],
    [120, `'er Strähne...wtf?`],
    [130, `'er Strähne...wenn wir mal so viel Talent in irgendwas anderem hätten`],
    [150, `'er Strähne...ich call hacks`],
  ];
  
  const specialTexts = new Map([
    [10, `'er Strähne...so viel wie 10 Jähriger!`],
    [18, `'er Strähne...darauf erstmal nen Schnaps`],
    [30, `'er Strähne...endlich 30!`],
    [40, `'er Strähne! Fast so gut wie A von Stairs halten`],
    [42, `'er Strähne...irgendwas irgendwas Antwort auf alles`],
    [50, `'er Strähne...Mohrenkopfbrötchen? FUFFZISCH`],
    [69, `'er Strähne...nice`],
    [88, `'er Strähne...monkaS`],
    [90, `'er Strähne...wenn das mal die ADR von JEDEM wäre...`],
    [96, `'er Strähne...ecin`],
    [100, `'er Strähne...average HP jedes Gegners nach einem Jordi-Execute™`],
    [101, `'er Strähne...irgendwas irgendwas Dalmatiner`],
    [103, `'er Strähne...alles Hurensöhne hier...damit habt ihr nicht gerechnet oder?`],
    [110, `'er Strähne...Google behauptet ich bekomme ein Bewusstsein`],
  ]);

  let quip;
  if (specialTexts.has(counter)) {
    quip = specialTexts.get(counter);
  } else {
    quip = messageTexts
      .sort((l, r) => r[0] - l[0]) // sort descending, so it's easier to iterate
      .find(([upTo]) => counter >= upTo)[1] || 'I bims kabott';
  }

  return `${counter}${quip}`;
}


/**
 * @param {WAWebJS.Chat} chat 
 * @param {StreakCounter} globalCounter
 * @param {StreakCounter[]} personalCounters
 */
async function reportResult(chat, globalCounter, personalCounters) {
  console.log('L33t count:', globalCounter.streak);
  const personalMsgs = await Promise.all(personalCounters
    .filter(p => p.isRelevant())
    .map(c => c.getMessage()));
  personalMsgs.sort((l, r) => l.localeCompare(r));
  let finalMsg = `*[L33T Bot]: ${getMessageQuip(globalCounter.streak)}*\n`
    + `------------------------------------------\n`
    + `${personalMsgs.join('\n')}`;

  // resolve random fact of the day
  try {
    const daysSinceStart = Math.floor((Date.now() - Date.parse("2022-06-25")) / (1000 * 60 * 60 * 24));
    const facts = JSON.parse(fs.readFileSync('facts.json', 'utf-8'));
    const factOfDay = facts[daysSinceStart % facts.length];
    finalMsg += `\n------------------------------------------\nFakt des Tages: ${factOfDay}`;
  } catch (e) {
    console.log(e);
  }

  // check sob of the day (everyone who didn't l33t today is a candidate)
  const sobs = personalCounters.filter(p => p.streak === 0);
  finalMsg += `\n------------------------------------------\nNicht-l33tender Hurensohn des Tages: `;
  if (sobs.length > 0) {
    const sob = sobs[Math.floor(Math.random() * sobs.length)];
    const sobName = await sob.resolveAuthorName();
    finalMsg += sobName;
  } else {
    finalMsg += 'Niemand!';
  }

  console.log('Sending message:', finalMsg);
  // chat.sendMessage(finalMsg).then(() => {
    setTimeout(() => shutdown(0), 5000);
  // });
}


/**
 * Look through cached messages and examine leet streak
 * @param {WAWebJS.Chat} chat
 * @param {CacheMessage} cacheMsgs 
 * @returns 
 */
function examineMessages(chat, cacheMsgs) {
  let day = new Date();
  const globalCounter = new StreakCounter();
  /** @type {Map<string, StreakCounter>} */
  const personalCounters = new Map(chat.participants.map(({id}) => [id._serialized, new StreakCounter(id._serialized)]));

  let examinedCount = 0;
  for (let msg of [...cacheMsgs].reverse()) {
    examinedCount += 1;
    const msgTime = new Date(msg.timestamp * 1000);

    // is this message already on the next day?
    if ((day - msgTime) > DAY_MS) {
      if (!globalCounter.l33ted) { // no leet for whole day? :(
        console.log('Streak ended, examined messages:', examinedCount, ', day:', day, ', msgTime:', msgTime);
        reportResult(chat, globalCounter, [...personalCounters.values()]);
        return true; // all done
      }

      // roll over to next day
      day -= DAY_MS;
      globalCounter.wrapNextDay();
      personalCounters.forEach(c => c.wrapNextDay());
    }

    if (
      msgTime.getHours() === 13 &&
      msgTime.getMinutes() === 37 &&
      msg.body.match(/[1l]3{2,}[7t]/i)
    ) {
      globalCounter.countL33t();
      // if author is undefined it's ourselves
      let {author = client.info.wid._serialized} = msg;
      let personal = personalCounters.get(author);
      if (personal) {
        personal.countL33t();
      } else {
        console.error('no personal counter for author', author);
      }
    }
  }

  return false; // not enough messages
}


/**
 * @param {WAWebJS.Chat} chat
 * @param {MsgCache} msgCache
 * @param {number} maxMsgCount
 */
async function countL33ts(chat, msgCache, maxMsgCount = 500) {
  if (maxMsgCount > (1000 * 100))
    throw Error("Exceeded maximum limit of requestable messages");

  // get messages from WhatsApp Web
  const messages = await chat.fetchMessages({limit: maxMsgCount});
  if (messages.length < maxMsgCount) {
    throw new Error("Unable to get requested amount of messages");
  }

  const cacheMsgs = msgCache.appendMessages(messages);
  if (!cacheMsgs) {
    // not enough messages to connect to the newest message in cache, request more!
    const nextMsgCount = Math.round(maxMsgCount * 1.5);
    console.log('not enough messages to connect to cache, trying again with ', nextMsgCount);
    countL33ts(chat, msgCache, nextMsgCount);
    return;
  }

  if (examineMessages(chat, cacheMsgs)) {
    msgCache.writeToDisk();
  } else {
    // don't have enough messages?
    const nextMsgCount = Math.round(maxMsgCount * 1.5);
    console.log('not enough messages, trying again with ', nextMsgCount);
    msgCache.clear(); // apparently there's not enough in the cache?! clear it.
    countL33ts(chat, msgCache, nextMsgCount);
  }
}


client.on('qr', (qr) => {
  qrcode.toFile(QR_FILENAME, qr);
  console.log('received QR, please scan!');

  shutdownTimer = setTimeout(() => {
    console.log('timeout over, shutting down');
    shutdown(1);
  }, 1000 * 60 * 5); // 5 minutes
});


client.on('authenticated', () => {
  console.log('Authenticated!');
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
});


client.on('ready', () => {
  console.log('client is ready!');
  client.getChatById(GROUP_ID).then((chat) => {
    const msgCache = new MsgCache(chat.id._serialized, 'cache');
    msgCache.readFromDisk();

    countL33ts(chat, msgCache);
  });
});


client.on('auth_failure', (msg) => {
  console.error('Authentication error!', msg);
  shutdown(1);
});


client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
  shutdown(1);
});


client.initialize();
