
const qrcode = require('qrcode');
const WAWebJS = require('whatsapp-web.js');
const fetch = require('node-fetch');

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
    [0, `RIP STRÄHNE Sadge`],
    [1, `...alles fängt mal klein an`],
    [5, `'er Strähne...weiter so!`],
    [10, `'er Strähne...nice!`],
    [15, `'er Strähne...hype!`],
    [25, `'er Strähne! MEGAHYPE!`],
    [40, `'er Strähne...POGGERS!`],
    [50, `'er Strähne...MEGA POGGERS!`],
  ];
  
  const specialTexts = new Map([
    [10, `'er Strähne...so viel wie 10 Jähriger!`],
    [18, `'er Strähne...darauf erstmal nen Schnaps`],
    [30, `'er Strähne...endlich 30!`],
    [40, `'er Strähne! Fast so gut wie A von Stairs halten`],
    [50, `'er Strähne...Mohrenkopfbrötchen? FUFFZISCH`],
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
    const factOfDay = await fetch('https://uselessfacts.jsph.pl/random.json?language=de')
      .then(r => r.json())
      .then(j => j.text);
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
  chat.sendMessage(finalMsg).then(() => {
    setTimeout(() => shutdown(0), 5000);
  });
}


/**
 * @param {WAWebJS.Chat} chat
 * @param {number} maxMsgCount
 */
async function countL33ts(chat, maxMsgCount = 500) {
  let day = new Date();
  const globalCounter = new StreakCounter();
  /** @type {Map<string, StreakCounter>} */
  const personalCounters = new Map(chat.participants.map(({id}) => [id._serialized, new StreakCounter(id._serialized)]));

  const messages = await chat.fetchMessages({limit: maxMsgCount});
  for (let msg of messages.reverse()) {
    const msgTime = new Date(msg.timestamp * 1000);

    // is this message already on the next day?
    if ((day - msgTime) > DAY_MS) {
      if (!globalCounter.l33ted) { // no leet for whole day? :(
        reportResult(chat, globalCounter, [...personalCounters.values()]);
        return;
      }

      // roll over to next day
      day -= DAY_MS;
      globalCounter.wrapNextDay();
      personalCounters.forEach(c => c.wrapNextDay());
    }

    if (
      msgTime.getHours() === 13 &&
      msgTime.getMinutes() === 37 &&
      msg.body.toLowerCase().includes('l33t')
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

  const nextMsgCount = Math.round(maxMsgCount * 1.5);
  console.log('not enough messages, trying again with ', nextMsgCount);
  countL33ts(chat, nextMsgCount);
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
    countL33ts(chat);
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
